import * as nip19 from 'nostr-tools/nip19';

/**
 * Decodes a base36-encoded pubkey (0-9, a-z) into hexadecimal.
 * A 256-bit pubkey is typically 49–50 characters in base36.
 */
export function decodeBase36Pubkey(str: string): string | null {
  if (!/^[a-z0-9]+$/i.test(str)) return null;
  try {
    let num = BigInt(0);
    for (const char of str.toLowerCase()) {
      const digit = parseInt(char, 36);
      if (Number.isNaN(digit)) return null;
      num = num * BigInt(36) + BigInt(digit);
    }
    let hex = num.toString(16);
    if (hex.length > 64) return null;
    hex = hex.padStart(64, '0');
    return hex;
  } catch {
    return null;
  }
}

/**
 * Encodes a hexadecimal pubkey (64 characters) into base36.
 */
export function encodePubkeyToBase36(pubkey: string): string | null {
  if (!/^[a-f0-9]{64}$/i.test(pubkey)) return null;
  try {
    const num = BigInt('0x' + pubkey);
    return num.toString(36);
  } catch {
    return null;
  }
}

/**
 * Detects whether a string is a plausible base36-encoded pubkey.
 * A 256-bit pubkey is between 49 and 50 characters in base36.
 */
export function isBase36Pubkey(str: string): boolean {
  if (str.length < 49 || str.length > 52) return false;
  if (!/^[a-z0-9]+$/i.test(str)) return false;
  const hex = decodeBase36Pubkey(str);
  return hex !== null && /^[a-f0-9]{64}$/.test(hex);
}

/**
 * Resolves a Nostr address (hex, npub, base36, or email local part) into a pubkey.
 * If the input contains '@', only the local part (before '@') is considered.
 * Does NOT resolve NIP-05 pseudonyms (use NIP-05 for that).
 */
export function resolveNostrPubkey(address: string): string | null {
  const localPart = address.includes('@') ? address.split('@')[0] : address;

  // npub
  if (localPart.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(localPart);
      if (decoded.type === 'npub') return decoded.data as string;
    } catch {
      return null;
    }
  }

  // hex
  if (/^[a-f0-9]{64}$/i.test(localPart)) {
    return localPart.toLowerCase();
  }

  // base36
  if (isBase36Pubkey(localPart)) {
    const hex = decodeBase36Pubkey(localPart);
    if (hex) return hex;
  }

  return null;
}
