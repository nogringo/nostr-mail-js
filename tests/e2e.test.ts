import { describe, it, expect } from 'vitest';
import { NostrMailClient } from '../src/client.js';
import { startLocalRelay } from './local-relay.js';
import { createLocalUser } from './local-user.js';

describe('Nostr Mail E2E (Local Relay)', () => {
  it('should send and receive an email between two real clients', async () => {
    const relay = await startLocalRelay();
    let sender: NostrMailClient | undefined;
    let recipient: NostrMailClient | undefined;

    const senderUser = createLocalUser(relay);
    const recipientUser = createLocalUser(relay);

    try {
      sender = new NostrMailClient(senderUser.secretKey, senderUser.clientOptions);
      recipient = new NostrMailClient(recipientUser.secretKey, recipientUser.clientOptions);

      const uniqueId = Math.random().toString(36).substring(7);
      const testSubject = `E2E-${uniqueId}`;
      const testBody = `Local Nostr E2E message. ID: ${uniqueId}`;

      // 3. Wait for reception promise
      const receivePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          stopListening();
          reject(new Error('Timeout: Email was not received after 5s on local relay'));
        }, 5000);

        const stopListening = recipient!.onEmail((email) => {
          if (email.subject === testSubject) {
            clearTimeout(timeout);
            stopListening();
            resolve(email);
          }
        });
      });

      // 4. Send
      await sender.sendEmail({
        to: recipientUser.npub,
        subject: testSubject,
        text: testBody
      });

      // 5. Wait
      const receivedEmail: any = await receivePromise;

      // 6. Assert
      expect(receivedEmail.text.trim()).toBe(testBody);
      expect(receivedEmail.from.pubkey).toBe(senderUser.pubkey);
    } finally {
      await sender?.close();
      await recipient?.close();
      await relay.stop();
    }
  }, 10000);
});
