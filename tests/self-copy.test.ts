import { describe, it, expect } from 'vitest';
import { NostrMailClient } from '../src/client.js';
import { startLocalRelay } from './local-relay.js';
import { createLocalUser } from './local-user.js';

describe('Nostr Mail E2E - Self Copy', () => {
  it('should receive a copy when selfCopy is true (default)', async () => {
    const relay = await startLocalRelay();
    const user = createLocalUser(relay);
    const recipientUser = createLocalUser(relay);
    const client = new NostrMailClient(user.secretKey, user.clientOptions);

    try {
      const uniqueId = Math.random().toString(36).substring(7);
      const testSubject = `SelfCopy-True-${uniqueId}`;

      await client.sendEmail({
        to: recipientUser.npub,
        subject: testSubject,
        text: 'This should appear in my inbox',
      });

      const emails = await client.listEmails();
      const found = emails.some(e => e.subject === testSubject);
      
      expect(found).toBe(true);
    } finally {
      await client.close();
      await relay.stop();
    }
  }, 10000);

  it('should NOT receive a copy when selfCopy is false', async () => {
    const relay = await startLocalRelay();
    const user = createLocalUser(relay);
    const recipientUser = createLocalUser(relay);
    const client = new NostrMailClient(user.secretKey, user.clientOptions);

    try {
      const uniqueId = Math.random().toString(36).substring(7);
      const testSubject = `SelfCopy-False-${uniqueId}`;

      await client.sendEmail({
        to: recipientUser.npub,
        subject: testSubject,
        text: 'This should NOT appear in my inbox',
        selfCopy: false
      });

      const emails = await client.listEmails();
      const found = emails.some(e => e.subject === testSubject);
      
      expect(found).toBe(false);
    } finally {
      await client.close();
      await relay.stop();
    }
  }, 10000);
});
