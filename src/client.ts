import {
  finalizeEvent,
  getPublicKey,
} from 'nostr-tools/pure';
import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool';
import { Filter } from 'nostr-tools/filter';
import * as nip19 from 'nostr-tools/nip19';
import * as nip05 from 'nostr-tools/nip05';
import {
  wrapEvent,
  unwrapEvent,
} from 'nostr-tools/nip59';
import { EmailParser } from './parser.js';
import { EmailComposer } from './composer.js';
import { Email, SendEmailOptions } from './types.js';
import { encryptAESGCM, decryptAESGCM, createBlossomClient } from './blossom.js';
import { BOOTSTRAP_RELAYS, DEFAULT_RELAYS, DEFAULT_BLOSSOM_SERVERS, DEFAULT_DM_RELAYS } from './constants.js';

/**
 * Automatically handle Node.js environment for WebSocket support.
 */
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  try {
    const { default: WebSocket } = await import('ws');
    useWebSocketImplementation(WebSocket);
  } catch (e) {
    // ws not installed, user must call useWebSocketImplementation manually if in Node
  }
}

export class NostrMailClient {
  public pool: SimplePool;
  public parser: EmailParser;
  public composer: EmailComposer;
  private relays: string[];
  private blossomServers: string[];
  private secretKey: Uint8Array;
  public pubkey: string;
  private relaysInitialized: boolean = false;

  constructor(secretKey: Uint8Array, relays: string[] = [], blossomServers: string[] = []) {
    this.secretKey = secretKey;
    this.pubkey = getPublicKey(secretKey);
    this.relays = relays;
    this.blossomServers = blossomServers.length > 0 ? blossomServers : [...DEFAULT_BLOSSOM_SERVERS];
    this.pool = new SimplePool({
      enablePing: true,
      enableReconnect: true,
    });
    this.pool.automaticallyAuth = () => async (authEvent: any) => {
      return finalizeEvent(authEvent, this.secretKey);
    };
    this.parser = new EmailParser();
    this.composer = new EmailComposer();

    if (relays.length > 0) {
      this.relaysInitialized = true;
    }
  }

  private getAuthParams() {
    return {
      onauth: async (authEvent: any) => {
        return finalizeEvent(authEvent, this.secretKey);
      }
    };
  }

  /**
   * Add a relay to the client.
   */
  addRelay(url: string) {
    if (!this.relays.includes(url)) {
      this.relays.push(url);
      this.relaysInitialized = true;
    }
  }

  /**
   * Remove a relay from the client.
   */
  removeRelay(url: string) {
    this.relays = this.relays.filter(r => r !== url);
  }

  /**
   * Automatically discover relays if none are provided.
   */
  private async ensureRelays() {
    if (this.relaysInitialized && this.relays.length > 0) {
      return;
    }

    if (this.relays.length === 0) {
      // Try to find NIP-65 relays for this pubkey
      try {
        const relayEvents = await this.pool.querySync(BOOTSTRAP_RELAYS, {
          kinds: [10002],
          authors: [this.pubkey]
        });

        if (relayEvents.length > 0) {
          const lastEvent = relayEvents.sort((a, b) => b.created_at - a.created_at)[0];
          this.relays = lastEvent.tags
            .filter(t => t[0] === 'r')
            .map(t => t[1]);
        }
      } catch (e) {
        // Fallback to defaults if lookup fails
      }

      if (this.relays.length === 0) {
        this.relays = [...DEFAULT_RELAYS];
      }
    }

    this.relaysInitialized = true;
  }

  /**
   * Send an email to a Nostr user or an email address.
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    await this.ensureRelays();
    const fromAddress = `${nip19.npubEncode(this.pubkey)}@nostr`;

    // Use provided MIME or compose a new one
    const mime = options.mime || this.composer.composeMime(options, fromAddress);

    const recipient = await this.resolveRecipient(options.to);

    const emailEvent: any = {
      kind: 1301,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', recipient.pubkey],
        ['subject', options.subject],
        ['from', fromAddress],
        ['to', Array.isArray(options.to) ? options.to.join(', ') : options.to],
        ['date', Math.floor(Date.now() / 1000).toString()]
      ],
      content: mime,
    };

    // Handle large emails (> 60KB) with Blossom storage
    const mimeBytes = new TextEncoder().encode(mime);
    if (mimeBytes.length >= 60000 && this.blossomServers.length > 0) {
      const { encrypted, key, nonce, hash } = await encryptAESGCM(mimeBytes);

      let uploadSuccessful = false;
      const uploadErrors: string[] = [];

      await Promise.all(this.blossomServers.map(async (server) => {
        try {
          const blossom = createBlossomClient(server, this.secretKey);
          await blossom.uploadBlob(new Blob([encrypted as any]), 'application/octet-stream');
          uploadSuccessful = true;
        } catch (e: any) {
          uploadErrors.push(`${server}: ${e.message}`);
        }
      }));

      if (!uploadSuccessful) {
        throw new Error(`Failed to upload email to any Blossom server. Errors: ${uploadErrors.join(', ')}`);
      }

      emailEvent.content = '';
      emailEvent.tags.push(['encryption-algorithm', 'aes-gcm']);
      emailEvent.tags.push(['decryption-key', key]);
      emailEvent.tags.push(['decryption-nonce', nonce]);
      emailEvent.tags.push(['x', hash]);
    }

    // Handle bridge specific tags if it's an external email
    if (recipient.isBridge) {
      emailEvent.tags.push(['mail-from', fromAddress]);
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      recipients.forEach(r => emailEvent.tags.push(['rcpt-to', r]));
    }

    // Gift wrap for privacy (NIP-59)
    const wrappedEvent = wrapEvent(emailEvent, this.secretKey, recipient.pubkey);

    // MAXIMIZE DELIVERABILITY: Discover recipient relays
    const targetRelays = new Set<string>([...this.relays, ...DEFAULT_DM_RELAYS]);

    try {
      const recipientRelayEvents = await this.pool.querySync(BOOTSTRAP_RELAYS, {
        kinds: [10002],
        authors: [recipient.pubkey]
      });
      if (recipientRelayEvents.length > 0) {
        const lastEvent = recipientRelayEvents.sort((a, b) => b.created_at - a.created_at)[0];
        lastEvent.tags
          .filter(t => t[0] === 'r')
          .forEach(t => targetRelays.add(t[1]));
      }
    } catch (e) {
      // Ignore discovery errors
    }

    const publishPromises = [
      ...this.pool.publish(Array.from(targetRelays), wrappedEvent, this.getAuthParams())
    ];

    // Also send a copy to ourselves if enabled (Sent folder / local copy)
    // Default to true as per NIP-17 usage
    const shouldCopy = options.selfCopy !== false;
    if (shouldCopy) {
      const selfWrappedEvent = wrapEvent(emailEvent, this.secretKey, this.pubkey);
      publishPromises.push(...this.pool.publish(this.relays, selfWrappedEvent, this.getAuthParams()));
    }

    // Wait for all to finish, ignoring individual relay errors (like rate-limiting)
    await Promise.allSettled(publishPromises);
  }


  /**
   * Parse a Gift Wrap event into an Email object.
   * Handles NIP-59 unwrapping, Blossom content resolution and parsing.
   */
  async fromGiftWrap(giftWrap: any, skipLabels: boolean = false): Promise<Email | null> {
    try {
      const unwrapped = unwrapEvent(giftWrap, this.secretKey);
      if (unwrapped.kind !== 1301) {
        return null;
      }

      const fullEvent = await this.ensureMimeContent(unwrapped as any);
      const labels = skipLabels ? [] : await this.getLabelsForEvent(unwrapped.id);

      return await this.parser.parse(unwrapped as any, labels, fullEvent.content, giftWrap.id);
    } catch (e) {
      return null;
    }
  }

  /**
   * Listen for incoming emails in real-time.
   */
  onEmail(callback: (email: Email) => void) {
    let sub: { close: () => void } | undefined;
    let closed = false;

    this.ensureRelays().then(() => {
      if (closed) return;

      const filter: Filter = {
        kinds: [1059], // Gift wraps
        '#p': [this.pubkey],
      };

      sub = this.pool.subscribeMany(this.relays, filter, {
        ...this.getAuthParams(),
        onevent: async (wrappedEvent) => {
          const email = await this.fromGiftWrap(wrappedEvent);
          if (email) callback(email);
        }
      });
    });

    return () => {
      closed = true;
      if (sub) sub.close();
    };
  }

  /**
   * List emails from inbox.
   */
  async listEmails(): Promise<Email[]> {
    await this.ensureRelays();

    const emailFilter: Filter = {
      kinds: [1059],
      '#p': [this.pubkey],
      limit: 100,
    };

    const deletionFilter: Filter = {
      kinds: [5],
      authors: [this.pubkey],
      '#k': ['1059'],
      limit: 100,
    };

    let allEvents: any[] = [];
    try {
      const [receivedEvents, deletionEvents] = await Promise.all([
        this.pool.querySync(this.relays, emailFilter),
        this.pool.querySync(this.relays, deletionFilter)
      ]);
      allEvents = [...receivedEvents, ...deletionEvents];
    } catch (e) {
      // Ignore individual relay errors
    }

    const deletedIds = new Set<string>();
    const wrappedEvents: any[] = [];

    for (const ev of allEvents) {
      if (ev.kind === 5) {
        ev.tags.filter((t: string[]) => t[0] === 'e').forEach((t: string[]) => deletedIds.add(t[1]));
      } else if (ev.kind === 1059) {
        wrappedEvents.push(ev);
      }
    }

    const emails: Email[] = [];
    for (const wrapped of wrappedEvents) {
      if (deletedIds.has(wrapped.id)) continue;
      const email = await this.fromGiftWrap(wrapped);
      if (email) emails.push(email);
    }

    return emails.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Ensure the event has its MIME content (download from Blossom if needed).
   */
  public async ensureMimeContent(event: any): Promise<any> {
    if (event.content) return event;

    const xTag = event.tags.find((t: any[]) => t[0] === 'x');
    const keyTag = event.tags.find((t: any[]) => t[0] === 'decryption-key');
    const nonceTag = event.tags.find((t: any[]) => t[0] === 'decryption-nonce');

    if (xTag && keyTag && nonceTag && this.blossomServers.length > 0) {
      const hash = xTag[1];

      for (const server of this.blossomServers) {
        try {
          const blossom = createBlossomClient(server, this.secretKey);
          const arrayBuffer = await blossom.download(hash);
          const decrypted = await decryptAESGCM(new Uint8Array(arrayBuffer), keyTag[1], nonceTag[1]);
          return {
            ...event,
            content: new TextDecoder().decode(decrypted)
          };
        } catch (e) {
          // Try next server
          continue;
        }
      }
    }

    return event;
  }

  private async getLabelsForEvent(eventId: string): Promise<string[]> {
    const filter: Filter = {
      kinds: [1985],
      authors: [this.pubkey],
      '#e': [eventId],
      '#L': ['mail'],
    };

    try {
      const labelEvents = await this.pool.querySync(this.relays, filter);
      return labelEvents.flatMap(ev =>
        ev.tags.filter(t => t[0] === 'l' && t[2] === 'mail').map(t => t[1])
      );
    } catch (e) {
      return [];
    }
  }

  /**
   * Add a label to an email (e.g., mark as read, move to folder).
   */
  async addLabel(eventId: string, label: string): Promise<void> {
    await this.ensureRelays();
    const labelEvent = finalizeEvent({
      kind: 1985,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['L', 'mail'],
        ['l', label, 'mail'],
        ['e', eventId, '', 'labelled']
      ],
      content: '',
    }, this.secretKey);

    await Promise.allSettled(this.pool.publish(this.relays, labelEvent, this.getAuthParams()));
  }

  /**
   * Delete an email.
   * This will delete:
   * 1. The email event itself (Gift Wrap or 1301)
   * 2. All associated labels (Kind 1985)
   * 3. The Blossom blob if it exists
   */
  async deleteEmail(email: Email, reason: string = ''): Promise<void> {
    await this.ensureRelays();

    // 1. Collect all IDs to delete from relays
    const idsToDelete: { id: string, kind: number }[] = [];

    // The main email event (Gift Wrap or 1301)
    idsToDelete.push({
      id: email.giftWrapId || email.id,
      kind: email.giftWrapId ? 1059 : 1301
    });

    // All label events (Kind 1985)
    const labelFilter: Filter = {
      kinds: [1985],
      authors: [this.pubkey],
      '#e': [email.id],
      '#L': ['mail'],
    };

    try {
      const labelEvents = await this.pool.querySync(this.relays, labelFilter);
      labelEvents.forEach(ev => idsToDelete.push({ id: ev.id, kind: 1985 }));
    } catch (e) {
      // Continue even if label lookup fails
    }

    // 2. Perform relay deletions (Kind 5)
    const deletionTags = idsToDelete.map(item => ['e', item.id]);
    // NIP-09 recommends adding 'k' tags for each kind being deleted
    const kinds = Array.from(new Set(idsToDelete.map(item => item.kind.toString())));
    kinds.forEach(k => deletionTags.push(['k', k]));

    const deletionEvent = finalizeEvent({
      kind: 5,
      created_at: Math.floor(Date.now() / 1000),
      tags: deletionTags,
      content: reason,
    }, this.secretKey);

    const relayPromises = this.pool.publish(this.relays, deletionEvent, this.getAuthParams());

    // 3. Perform Blossom deletion if needed
    const blossomPromises: Promise<any>[] = [];
    const xTag = email.event.tags.find(t => t[0] === 'x');
    if (xTag && this.blossomServers.length > 0) {
      const hash = xTag[1];
      blossomPromises.push(...this.blossomServers.map(async (server) => {
        try {
          const blossom = createBlossomClient(server, this.secretKey);
          await blossom.delete(hash);
        } catch (e) {
          // Ignore individual blossom server errors
        }
      }));
    }

    await Promise.allSettled([...relayPromises, ...blossomPromises]);
  }

  /**
   * Delete an event (email or label) using Kind 5 deletion request.
   */
  async deleteEvent(eventId: string, reason: string = '', kind?: number): Promise<void> {
    await this.ensureRelays();

    const tags = [['e', eventId]];
    if (kind !== undefined) {
      tags.push(['k', kind.toString()]);
    }

    const deletionEvent = finalizeEvent({
      kind: 5,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: reason,
    }, this.secretKey);

    await Promise.allSettled(this.pool.publish(this.relays, deletionEvent, this.getAuthParams()));
  }

  /**
   * Resolve a recipient (npub, hex pubkey, or email bridge).
   */
  private async resolveRecipient(to: string | string[]): Promise<{ pubkey: string, isBridge: boolean }> {
    const firstRecipient = Array.isArray(to) ? to[0] : to;

    // 1. npub
    if (firstRecipient.startsWith('npub1')) {
      const { data } = nip19.decode(firstRecipient);
      return { pubkey: data as string, isBridge: false };
    }

    // 2. Email address (needs bridge)
    if (firstRecipient.includes('@') && !firstRecipient.endsWith('@nostr')) {
      const domain = firstRecipient.split('@')[1];
      const bridgeProfile = await nip05.queryProfile(`_smtp@${domain}`);
      if (!bridgeProfile || !bridgeProfile.pubkey) {
        throw new Error(`Could not resolve bridge for domain ${domain}`);
      }
      return { pubkey: bridgeProfile.pubkey, isBridge: true };
    }

    // 3. Hex pubkey
    return { pubkey: firstRecipient, isBridge: false };
  }

  async close() {
    this.pool.destroy();
  }
}
