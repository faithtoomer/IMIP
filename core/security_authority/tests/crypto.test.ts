import { describe, expect, it } from 'vitest';
import { sha256Hex, checksum, secureRandomToken } from '../src/crypto.js';

describe('crypto.ts (§11 — Cryptographic Services)', () => {
  it('sha256Hex is deterministic and matches a known vector', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('checksum agrees with sha256Hex', () => {
    expect(checksum('hello')).toBe(sha256Hex('hello'));
  });

  it('secureRandomToken produces distinct, correctly-sized hex tokens', () => {
    const a = secureRandomToken(16);
    const b = secureRandomToken(16);
    expect(a).not.toBe(b);
    expect(a).toHaveLength(32); // 16 bytes -> 32 hex chars
  });
});
