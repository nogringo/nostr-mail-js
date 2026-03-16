import { BlossomClient } from 'nostr-tools/nipb7';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';

export interface EncryptionResult {
  encrypted: Uint8Array;
  key: string;
  nonce: string;
  hash: string;
}

export async function encryptAESGCM(data: Uint8Array): Promise<EncryptionResult> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    data as any
  );
  
  const encrypted = new Uint8Array(encryptedBuffer);
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const hash = bytesToHex(sha256(encrypted));

  return {
    encrypted,
    key: Buffer.from(exportedKey).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
    hash,
  };
}

export async function decryptAESGCM(encrypted: Uint8Array, keyB64: string, nonceB64: string): Promise<Uint8Array> {
  const keyBuffer = Buffer.from(keyB64, 'base64');
  const nonce = Buffer.from(nonceB64, 'base64');

  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    'AES-GCM',
    true,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    encrypted as any
  );

  return new Uint8Array(decrypted);
}

export function createBlossomClient(server: string, secretKey: Uint8Array) {
  return new BlossomClient(server, {
    async getPublicKey() {
      return getPublicKey(secretKey);
    },
    async signEvent(event: any) {
      return finalizeEvent(event, secretKey);
    }
  });
}
