import { describe, it, expect } from 'vitest';
import { NostrMailClient } from '../src/client.js';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';

describe('Nostr Mail E2E - Workflow', () => {
  it('should send, list, move to "done" folder, and then delete an email', async () => {
    const recipientSk = generateSecretKey();
    const recipientPk = getPublicKey(recipientSk);
    const recipientNpub = nip19.npubEncode(recipientPk);

    const sk = generateSecretKey();
    const client = new NostrMailClient(sk);
    const uniqueId = Math.random().toString(36).substring(7);
    const testSubject = `Workflow-${uniqueId}`;

    await client.sendEmail({
      to: recipientNpub,
      subject: testSubject,
      text: 'Testing workflow: send -> list -> move -> delete'
    });

    const emails = await client.listEmails();
    expect(emails.length).above(0);

    const myEmail = emails.find(e => e.subject === testSubject);

    expect(myEmail).toBeDefined();
    const emailId = myEmail!.id;

    await client.addLabel(emailId, 'folder:done');

    const updatedEmails = await client.listEmails();
    const movedEmail = updatedEmails.find(e => e.id === emailId);
    
    expect(movedEmail?.folder).toBe('done');

    await client.deleteEmail(movedEmail!);

    const finalEmails = await client.listEmails();
    expect(finalEmails.length).toBe(0);

    await client.close();
  }, 60000);
});
