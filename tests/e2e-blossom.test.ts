import { describe, it, expect } from 'vitest';
import { NostrMailClient } from '../src/client.js';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';

describe('Nostr Mail E2E - Large Email (Blossom)', () => {
  it('should handle > 100KB email using Blossom storage', async () => {
    const senderSk = generateSecretKey();
    const recipientSk = generateSecretKey();
    const recipientPk = getPublicKey(recipientSk);
    const recipientNpub = nip19.npubEncode(recipientPk);

    const sender = new NostrMailClient(senderSk);
    const recipient = new NostrMailClient(recipientSk);

    // Create a large body (~120 KB)
    const largeBody = "A".repeat(120 * 1024); 
    const testSubject = `Large-E2E-${Math.random().toString(36).substring(7)}`;

    console.log(`🚀 Sending large email (~${Math.round(largeBody.length / 1024)} KB) to ${recipientNpub}...`);

    const receivePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        stopListening();
        reject(new Error('Timeout: Large email not received via Blossom after 90s'));
      }, 90000);

      const stopListening = recipient.onEmail((email) => {
        console.log(`📩 Received email: ${email.subject}`);
        if (email.subject === testSubject) {
          clearTimeout(timeout);
          stopListening();
          resolve(email);
        }
      });
    });

    try {
      await sender.sendEmail({
        to: recipientNpub,
        subject: testSubject,
        text: largeBody
      });
    } catch (e) {
      console.warn('⚠️ Send might have partially failed, waiting for reception...', e);
    }

    const receivedEmail: any = await receivePromise;

    expect(receivedEmail.text.trim()).toBe(largeBody.trim());
    // In Blossom mode, the Nostr event content should be empty
    expect(receivedEmail.event.content).toBe("");
    // Check for Blossom specific tags
    const xTag = receivedEmail.event.tags.find((t: any[]) => t[0] === 'x');
    const algoTag = receivedEmail.event.tags.find((t: any[]) => t[0] === 'encryption-algorithm');
    
    expect(xTag).toBeDefined();
    expect(algoTag).toBeDefined();
    expect(algoTag[1]).toBe('aes-gcm');

    console.log('✅ Blossom E2E Success!');

    await sender.close();
    await recipient.close();
  }, 150000); // 2.5 minutes timeout for large data propagation
});
