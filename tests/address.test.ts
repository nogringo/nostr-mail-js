import { describe, it, expect } from 'vitest';
import {
  decodeBase36Pubkey,
  encodePubkeyToBase36,
  isBase36Pubkey,
  resolveNostrPubkey,
} from '../src/address.js';

describe('Base36 pubkey encoding', () => {
  const hexPubkey = 'a'.repeat(64); // 0xaaaa... (small value, should be short in base36)
  const realPubkey = 'b22b06b051fd5232966a9344a634d956c3dc33a7f5ecdcad9ed11ddc4120a7f2';

  it('should encode a hex pubkey to base36 and decode it back', () => {
    const base36 = encodePubkeyToBase36(realPubkey);
    expect(base36).toBeTypeOf('string');
    expect(base36!.length).toBeGreaterThanOrEqual(49);
    expect(base36!.length).toBeLessThanOrEqual(52);

    const decoded = decodeBase36Pubkey(base36!);
    expect(decoded).toBe(realPubkey);
  });

  it('should decode a known base36 string back to hex', () => {
    const base36 = encodePubkeyToBase36(hexPubkey);
    const decoded = decodeBase36Pubkey(base36!);
    expect(decoded).toBe(hexPubkey);
  });

  it('should pad leading zeros correctly', () => {
    const lowPubkey = '0'.repeat(63) + '1'; // 0x00...01
    const base36 = encodePubkeyToBase36(lowPubkey);
    const decoded = decodeBase36Pubkey(base36!);
    expect(decoded).toBe(lowPubkey);
  });

  it('should return null for invalid base36 strings', () => {
    expect(decodeBase36Pubkey('')).toBeNull();
    expect(decodeBase36Pubkey('!!!')).toBeNull();
    expect(decodeBase36Pubkey('too-short')).toBeNull();
  });

  it('should return null for invalid hex pubkeys', () => {
    expect(encodePubkeyToBase36('not-hex')).toBeNull();
    expect(encodePubkeyToBase36('abcd')).toBeNull();
  });

  it('should detect plausible base36 pubkeys', () => {
    const base36 = encodePubkeyToBase36(realPubkey)!;
    expect(isBase36Pubkey(base36)).toBe(true);
    expect(isBase36Pubkey('short')).toBe(false);
    expect(isBase36Pubkey('a'.repeat(70))).toBe(false);
  });
});

describe('resolveNostrPubkey', () => {
  const hexPubkey = 'b22b06b051fd5232966a9344a634d956c3dc33a7f5ecdcad9ed11ddc4120a7f2';
  const npub = 'npub1kg4sdvz3l4fr99n2jdz2vdxe2mpacva87hkdetv76ywacsfq5leqquw5te';

  it('should resolve a hex pubkey', () => {
    expect(resolveNostrPubkey(hexPubkey)).toBe(hexPubkey);
    expect(resolveNostrPubkey(hexPubkey.toUpperCase())).toBe(hexPubkey);
  });

  it('should resolve an npub', () => {
    const resolved = resolveNostrPubkey(npub);
    expect(resolved).toBeTypeOf('string');
    expect(resolved).toHaveLength(64);
  });

  it('should resolve a base36 pubkey', () => {
    const base36 = encodePubkeyToBase36(hexPubkey)!;
    expect(resolveNostrPubkey(base36)).toBe(hexPubkey);
  });

  it('should return null for unknown formats', () => {
    expect(resolveNostrPubkey('unknown')).toBeNull();
    expect(resolveNostrPubkey('alice@example.com')).toBeNull();
  });

  it('should extract local part from email addresses', () => {
    const base36 = encodePubkeyToBase36(hexPubkey)!;
    expect(resolveNostrPubkey(`${base36}@uid.ovh`)).toBe(hexPubkey);
    expect(resolveNostrPubkey(`${hexPubkey}@uid.ovh`)).toBe(hexPubkey);
    expect(resolveNostrPubkey(`${npub}@uid.ovh`)).toBeTypeOf('string');
  });
});
