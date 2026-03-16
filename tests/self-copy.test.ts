import { describe, it, expect } from 'vitest';
import { NostrMailClient } from '../src/client.js';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';

describe('Nostr Mail E2E - Self Copy', () => {
  it('should receive a copy when selfCopy is true (default)', async () => {
    const sk = generateSecretKey();
    const client = new NostrMailClient(sk);
    
    const recipientPk = getPublicKey(generateSecretKey());
    const recipientNpub = nip19.npubEncode(recipientPk);

    const uniqueId = Math.random().toString(36).substring(7);
    const testSubject = `SelfCopy-True-${uniqueId}`;

    await client.sendEmail({
      to: recipientNpub,
      subject: testSubject,
      text: 'This should appear in my inbox',
    });

    const emails = await client.listEmails();
    const found = emails.some(e => e.subject === testSubject);
    
    expect(found).toBe(true);

    await client.close();
  }, 60000);

  it('should NOT receive a copy when selfCopy is false', async () => {
    const sk = generateSecretKey();
    const client = new NostrMailClient(sk);
    
    const recipientPk = getPublicKey(generateSecretKey());
    const recipientNpub = nip19.npubEncode(recipientPk);

    const uniqueId = Math.random().toString(36).substring(7);
    const testSubject = `SelfCopy-False-${uniqueId}`;

    await client.sendEmail({
      to: recipientNpub,
      subject: testSubject,
      text: 'This should NOT appear in my inbox',
      selfCopy: false
    });

    const emails = await client.listEmails();
    const found = emails.some(e => e.subject === testSubject);
    
    expect(found).toBe(false);

    await client.close();
  }, 60000);
});
