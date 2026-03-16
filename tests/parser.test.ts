import { describe, it, expect } from 'vitest';
import { EmailParser } from '../src/parser.js';
import { Event } from 'nostr-tools/core';

describe('EmailParser', () => {
  const parser = new EmailParser();

  it('should parse a simple inline email', async () => {
    const mockEvent: Event = {
      id: 'event-id',
      kind: 1301,
      pubkey: 'sender-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', 'recipient-pubkey']],
      content: 'Subject: Hello World\nTo: recipient@example.com\n\nBody content',
      sig: 'signature'
    };

    const email = await parser.parse(mockEvent, []);

    expect(email.subject).toBe('Hello World');
    expect(email.text?.trim()).toBe('Body content');
    expect(email.from.pubkey).toBe('sender-pubkey');
    expect(email.folder).toBe('inbox'); // Default folder
    expect(email.isRead).toBe(false);   // Default state
  });

  it('should apply folder label correctly', async () => {
    const mockEvent: Event = {
      id: 'event-id',
      kind: 1301,
      pubkey: 'sender-pubkey',
      created_at: 1000,
      tags: [],
      content: 'Subject: Empty\n\nContent',
      sig: ''
    };

    const labels = ['folder:trash', 'state:read'];
    const email = await parser.parse(mockEvent, labels);

    expect(email.folder).toBe('trash');
    expect(email.isRead).toBe(true);
  });

  it('should throw if kind is not 1301', async () => {
    const badEvent = { kind: 1, content: '...' };
    await expect(parser.parse(badEvent as any, [])).rejects.toThrow('Not a Nostr Mail event');
  });
});
