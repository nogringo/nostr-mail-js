import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import type { NostrEvent } from 'nostr-mock-relay';
import type { NostrMailClientOptions } from '../src/client.js';
import type { LocalBlossom } from './local-blossom.js';
import type { LocalRelay } from './local-relay.js';

export type LocalUser = {
  secretKey: Uint8Array;
  pubkey: string;
  npub: string;
  clientOptions: NostrMailClientOptions;
};

export function localClientOptions(relay: LocalRelay, blossom?: LocalBlossom): NostrMailClientOptions {
  return {
    bootstrapRelays: relay.relays,
    defaultRelays: relay.relays,
    defaultDmRelays: relay.relays,
    defaultBlossomServers: blossom ? blossom.servers : [],
  };
}

export function createLocalUser(relay: LocalRelay, blossom?: LocalBlossom): LocalUser {
  const secretKey = generateSecretKey();
  const pubkey = getPublicKey(secretKey);
  const now = Math.floor(Date.now() / 1000);
  const blossomServers = blossom ? blossom.servers : [];

  const events = [
    finalizeEvent({
      kind: 10002,
      created_at: now,
      tags: relay.relays.map(url => ['r', url]),
      content: '',
    }, secretKey),
    finalizeEvent({
      kind: 10050,
      created_at: now,
      tags: relay.relays.map(url => ['relay', url]),
      content: '',
    }, secretKey),
    finalizeEvent({
      kind: 10063,
      created_at: now,
      tags: blossomServers.map(url => ['server', url]),
      content: '',
    }, secretKey),
  ] as NostrEvent[];

  relay.relay.seed(events);

  return {
    secretKey,
    pubkey,
    npub: nip19.npubEncode(pubkey),
    clientOptions: localClientOptions(relay, blossom),
  };
}
