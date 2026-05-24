import { describe, it, expect } from 'vitest';
import { buildEmailRumor } from '../src/email-rumor.js';

describe('buildEmailRumor', () => {
  const baseInput = {
    fromAddress: 'npub1sender...@nostr',
    recipient: { pubkey: 'recipient-pubkey', isBridge: false },
    mime: 'Subject: test\r\n\r\nbody',
  };

  it('builds a kind 1301 rumor with the basic envelope tags', () => {
    const rumor = buildEmailRumor({
      ...baseInput,
      options: { to: 'npub1recipient...@nostr', subject: 'hello' },
    });

    expect(rumor.kind).toBe(1301);
    expect(rumor.content).toBe(baseInput.mime);
    expect(rumor.tags).toEqual(
      expect.arrayContaining([
        ['p', 'recipient-pubkey'],
        ['subject', 'hello'],
        ['from', 'npub1sender...@nostr'],
        ['to', 'npub1recipient...@nostr'],
      ]),
    );
  });

  it('does not add a mail-from tag for direct nostr-to-nostr email', () => {
    const rumor = buildEmailRumor({
      ...baseInput,
      options: { to: 'npub1recipient...@nostr', subject: 'hello' },
    });

    expect(rumor.tags.find((t) => t[0] === 'mail-from')).toBeUndefined();
    expect(rumor.tags.find((t) => t[0] === 'rcpt-to')).toBeUndefined();
  });

  it('adds mail-from tag from options.mailFrom (inbound bridge case)', () => {
    // A bridge forwarding an inbound SMTP email passes the legacy sender's
    // address as mailFrom. Per spec, mail-from MUST be set and rcpt-to is
    // not used inbound.
    const rumor = buildEmailRumor({
      ...baseInput,
      options: {
        to: 'npub1recipient...@nostr',
        subject: 'hello',
        mailFrom: 'alice@example.com',
      },
    });

    expect(rumor.tags).toContainEqual(['mail-from', 'alice@example.com']);
    expect(rumor.tags.find((t) => t[0] === 'rcpt-to')).toBeUndefined();
  });

  it('adds mail-from + rcpt-to when the recipient is a bridge (outbound)', () => {
    const rumor = buildEmailRumor({
      ...baseInput,
      recipient: { pubkey: 'bridge-pubkey', isBridge: true },
      options: { to: 'bob@example.com', subject: 'hello' },
    });

    expect(rumor.tags).toContainEqual(['mail-from', 'npub1sender...@nostr']);
    expect(rumor.tags).toContainEqual(['rcpt-to', 'bob@example.com']);
  });

  it('emits one rcpt-to per recipient for outbound multi-recipient', () => {
    const rumor = buildEmailRumor({
      ...baseInput,
      recipient: { pubkey: 'bridge-pubkey', isBridge: true },
      options: {
        to: ['bob@example.com', 'carol@example.com'],
        subject: 'hello',
      },
    });

    const rcptTos = rumor.tags.filter((t) => t[0] === 'rcpt-to');
    expect(rcptTos).toEqual([
      ['rcpt-to', 'bob@example.com'],
      ['rcpt-to', 'carol@example.com'],
    ]);
  });
});
