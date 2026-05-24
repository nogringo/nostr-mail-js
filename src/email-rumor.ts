import { SendEmailOptions } from './types.js';

/**
 * The unsigned kind 1301 rumor produced by [buildEmailRumor].
 *
 * Has the shape NIP-59's `wrapEvent` expects (no `id`, `pubkey`, `sig`).
 * Mutable on purpose: the caller may push Blossom-related tags onto it
 * and replace `content` when the MIME exceeds the inline threshold.
 */
export interface EmailRumor {
  kind: 1301;
  created_at: number;
  tags: string[][];
  content: string;
}

export interface BuildEmailRumorInput {
  options: SendEmailOptions;
  /** `<sender_npub>@nostr` — what goes in the `from` tag. */
  fromAddress: string;
  recipient: { pubkey: string; isBridge: boolean };
  /** Raw RFC 2822 MIME, inline. */
  mime: string;
}

/**
 * Build the unsigned kind 1301 rumor for an email send.
 *
 * Bridge semantics (per nostr-mail-core spec):
 * - `options.mailFrom` set: caller is forwarding from a non-nostr sender
 *   (e.g. an inbound-bridge handing an SMTP email to a nostr user).
 *   Add `mail-from` with the legacy address; do NOT add `rcpt-to`.
 * - `options.mailFrom` unset and `recipient.isBridge`: outbound nostr →
 *   SMTP. Add `mail-from` (sender's bridge identity) and one `rcpt-to`
 *   per legacy recipient.
 * - Otherwise: direct nostr-to-nostr, no bridge tags.
 */
export function buildEmailRumor(input: BuildEmailRumorInput): EmailRumor {
  const { options, fromAddress, recipient, mime } = input;
  const now = Math.floor(Date.now() / 1000);
  const toField = Array.isArray(options.to)
    ? options.to.join(', ')
    : options.to;

  const tags: string[][] = [
    ['p', recipient.pubkey],
    ['subject', options.subject],
    ['from', fromAddress],
    ['to', toField],
    ['date', now.toString()],
  ];

  if (options.mailFrom) {
    tags.push(['mail-from', options.mailFrom]);
  } else if (recipient.isBridge) {
    tags.push(['mail-from', fromAddress]);
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    recipients.forEach((r) => tags.push(['rcpt-to', r]));
  }

  return {
    kind: 1301,
    created_at: now,
    tags,
    content: mime,
  };
}
