import { describe, it, expect } from 'vitest';
import { NostrMailClient } from '../src/client.js';
import { startLocalRelay } from './local-relay.js';
import { startLocalBlossom } from './local-blossom.js';
import { createLocalUser } from './local-user.js';

describe('Nostr Mail E2E - Large Email (Local Blossom)', () => {
  it('should handle > 100KB email using Blossom storage', async () => {
    const relay = await startLocalRelay();
    const blossom = await startLocalBlossom();
    let sender: NostrMailClient | undefined;
    let recipient: NostrMailClient | undefined;
    const senderUser = createLocalUser(relay, blossom);
    const recipientUser = createLocalUser(relay, blossom);

    try {
      sender = new NostrMailClient(senderUser.secretKey, senderUser.clientOptions);
      recipient = new NostrMailClient(recipientUser.secretKey, recipientUser.clientOptions);

      // Create a large body (~120 KB)
      const largeBody = "A".repeat(120 * 1024); 
      const testSubject = `Large-E2E-${Math.random().toString(36).substring(7)}`;

      const receivePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          stopListening();
          reject(new Error('Timeout: Large email not received via local Blossom after 5s'));
        }, 5000);

        const stopListening = recipient!.onEmail((email) => {
          if (email.subject === testSubject) {
            clearTimeout(timeout);
            stopListening();
            resolve(email);
          }
        });
      });

      await sender.sendEmail({
        to: recipientUser.npub,
        subject: testSubject,
        text: largeBody
      });

      const receivedEmail: any = await receivePromise;

      expect(receivedEmail.text.trim()).toBe(largeBody.trim());
      // In Blossom mode, the Nostr event content should be empty
      expect(receivedEmail.event.content).toBe("");
      // Check for Blossom specific tags
      const xTag = receivedEmail.event.tags.find((t: any[]) => t[0] === 'x');
      const algoTag = receivedEmail.event.tags.find((t: any[]) => t[0] === 'encryption-algorithm');
      
      expect(xTag).toBeDefined();
      expect(blossom.server.hasBlob(xTag[1])).toBe(true);
      expect(algoTag).toBeDefined();
      expect(algoTag[1]).toBe('aes-gcm');
    } finally {
      await sender?.close();
      await recipient?.close();
      await relay.stop();
      await blossom.stop();
    }

  }, 10000);
});
