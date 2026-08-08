import { createHash, randomBytes } from 'node:crypto';

/** §11 — Cryptographic Services, backed entirely by Node's built-in
 * `node:crypto` (no new dependency — the same precedent as `node:sqlite`
 * and `fs.statfsSync`). */
export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Distinct name from `sha256Hex` because the spec lists "Hashing" and
 * "Checksum generation" as separate services — both are SHA-256 today, but
 * they answer different questions (integrity of a value vs. general
 * digest), and callers should name the one they mean. */
export function checksum(data: string | Buffer): string {
  return sha256Hex(data);
}

export function secureRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
