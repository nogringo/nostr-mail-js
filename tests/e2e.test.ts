import { describe, it, expect } from 'vitest';
import { NostrMailClient } from '../src/client.js';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';

describe('Nostr Mail E2E (Real Relays)', () => {
  it('should send and receive an email between two real clients', async () => {
    // 1. Setup Keys
    const senderSk = generateSecretKey();
    const recipientSk = generateSecretKey();
    const recipientPk = getPublicKey(recipientSk);
    const recipientNpub = nip19.npubEncode(recipientPk);

    // 2. Setup Clients
    const sender = new NostrMailClient(senderSk);
    const recipient = new NostrMailClient(recipientSk);

    const uniqueId = Math.random().toString(36).substring(7);
    const testSubject = `E2E-${uniqueId}`;
    const testBody = `Real Nostr E2E message. ID: ${uniqueId}`;

    console.log(`🚀 Sending email to ${recipientNpub}...`);

    // 3. Wait for reception promise
    const receivePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        stopListening();
        reject(new Error('Timeout: Email was not received after 45s on real relays'));
      }, 45000);

      const stopListening = recipient.onEmail((email) => {
        console.log(`📩 Received email with subject: ${email.subject}`);
        if (email.subject === testSubject) {
          clearTimeout(timeout);
          stopListening();
          resolve(email);
        }
      });
    });

    // 4. Send
    try {
      await sender.sendEmail({
        to: recipientNpub,
        subject: testSubject,
        text: testBody
      });
    } catch (e) {
      console.warn('⚠️ Some relays failed to publish, but delivery might still succeed:', e);
    }

    // 5. Wait
    const receivedEmail: any = await receivePromise;

    // 6. Assert
    expect(receivedEmail.text.trim()).toBe(testBody);
    expect(receivedEmail.from.pubkey).toBe(getPublicKey(senderSk));

    // Cleanup
    await sender.close();
    await recipient.close();
  }, 60000);
});
