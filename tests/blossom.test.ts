import { describe, it, expect } from 'vitest';
import { encryptAESGCM, decryptAESGCM } from '../src/blossom.js';

describe('Blossom AES-GCM Encryption', () => {
  it('should encrypt and decrypt a message correctly', async () => {
    const originalText = "Hello, this is a secret message for Blossom storage.";
    const data = new TextEncoder().encode(originalText);

    // 1. Encrypt
    const { encrypted, key, nonce, hash } = await encryptAESGCM(data);

    expect(encrypted).toBeDefined();
    expect(key).toBeTypeOf('string');
    expect(nonce).toBeTypeOf('string');
    expect(hash).toMatch(/^[a-f0-9]{64}$/); // Valid SHA-256 hex
    expect(encrypted).not.toStrictEqual(data);

    // 2. Decrypt
    const decrypted = await decryptAESGCM(encrypted, key, nonce);
    const decryptedText = new TextDecoder().decode(decrypted);

    // 3. Verify
    expect(decryptedText).toBe(originalText);
  });

  it('should produce different nonces for the same message', async () => {
    const data = new TextEncoder().encode("Same message");
    
    const res1 = await encryptAESGCM(data);
    const res2 = await encryptAESGCM(data);

    expect(res1.nonce).not.toBe(res2.nonce);
    expect(res1.encrypted).not.toStrictEqual(res2.encrypted);
  });
});
