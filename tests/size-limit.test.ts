import { describe, it, expect, vi } from 'vitest';
import { NostrMailClient } from '../src/client.js';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';

describe('NIP-44 Size Limit Reproduction (Realistic HTML)', () => {
  
  function generateRealisticHtml(targetSize: number): string {
    const head = '<html><body style="font-family: Arial, sans-serif; color: #333;"><div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">';
    const footer = '</div></body></html>';
    
    // This chunk is ~280 bytes and contains 8 double quotes.
    // In JSON, it expands by 8 bytes (escaped quotes).
    const chunk = `
      <div class="item" style="margin-bottom: 20px; padding: 10px; background: #f9f9f9;">
        <h2 style="color: #1a73e8;">Steam Support: Your account update</h2>
        <p>A new item has been added to your library. Please click <a href="https://store.steampowered.com/account/history/" target="_blank" style="font-weight: bold; color: #1a73e8; text-decoration: none;">here</a> to view your purchase history or contact "Steam Support" if you have any questions.</p>
      </div>`;
    
    let html = head;
    while (html.length + chunk.length + footer.length < targetSize) {
      html += chunk;
    }
    html += footer;
    return html;
  }

  it('should not throw "invalid plaintext size" with a large realistic HTML email (~59KB)', async () => {
    const senderSk = generateSecretKey();
    const client = new NostrMailClient(senderSk);

    // Generate ~59KB of HTML. 
    // Under the old logic (threshold 60KB), this would be sent "inline".
    // But with ~1500 double quotes, the JSON will expand by ~1.5KB,
    // pushing the total size over the 65,535 bytes NIP-44 limit.
    const realisticHtml = generateRealisticHtml(59000); 
    
    const recipientSk = generateSecretKey();
    const recipientNpub = nip19.npubEncode(getPublicKey(recipientSk));

    // This test will FAIL if the fix is not applied (throwing NIP-44 size error)
    // and PASS if the fix is applied (detecting the JSON size and using Blossom).
    await expect(client.sendEmail({
      to: recipientNpub,
      subject: 'Steam Support: Purchase Confirmation',
      html: realisticHtml
    })).resolves.not.toThrow();
  });
});
