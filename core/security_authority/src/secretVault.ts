import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { SecretNotFoundError, SecretVaultNotConfiguredError } from './errors.js';
import type { SecretRecord } from './types.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_DERIVATION_SALT = 'imip-ista-secret-vault-v1';

interface EncryptedSecret {
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
}

/**
 * §8 — the Secret Vault. Real AES-256-GCM encryption at rest, keyed via
 * `scrypt` from a caller-supplied master key (typically sourced from an
 * environment variable at the process boundary — the standard bootstrap
 * point for every real secrets-management system; ISTA doesn't invent its
 * own out-of-band trust root). Constructing without a master key succeeds
 * (Trust/Permission/Audit/Crypto services remain usable), but any attempt
 * to store or retrieve a secret throws `SecretVaultNotConfiguredError` —
 * the vault degrades gracefully rather than forcing every consumer to
 * configure a master key just to use ISTA's non-secret features.
 */
export class SecretVault {
  private readonly key?: Buffer;
  private readonly secrets = new Map<string, EncryptedSecret>();
  private readonly metadata = new Map<string, SecretRecord>();

  constructor(masterKey?: string) {
    if (masterKey) {
      this.key = scryptSync(masterKey, KEY_DERIVATION_SALT, 32);
    }
  }

  isConfigured(): boolean {
    return this.key !== undefined;
  }

  store(secretId: string, category: string, value: string): SecretRecord {
    const key = this.requireKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    this.secrets.set(secretId, { iv, authTag, ciphertext });

    const now = new Date().toISOString();
    const existing = this.metadata.get(secretId);
    const record: SecretRecord = {
      secretId,
      category,
      createdAt: existing?.createdAt ?? now,
      lastRotatedAt: now,
      lastAccessedAt: existing?.lastAccessedAt,
      accessCount: existing?.accessCount ?? 0,
    };
    this.metadata.set(secretId, record);
    return record;
  }

  retrieve(secretId: string): string {
    const key = this.requireKey();
    const stored = this.secrets.get(secretId);
    if (!stored) throw new SecretNotFoundError(secretId);

    const decipher = createDecipheriv(ALGORITHM, key, stored.iv);
    decipher.setAuthTag(stored.authTag);
    const plaintext = Buffer.concat([decipher.update(stored.ciphertext), decipher.final()]);

    const record = this.metadata.get(secretId)!;
    record.accessCount += 1;
    record.lastAccessedAt = new Date().toISOString();
    return plaintext.toString('utf-8');
  }

  rotate(secretId: string, newValue: string): SecretRecord {
    const existing = this.metadata.get(secretId);
    if (!existing) throw new SecretNotFoundError(secretId);
    return this.store(secretId, existing.category, newValue);
  }

  metadataFor(secretId: string): SecretRecord | undefined {
    return this.metadata.get(secretId);
  }

  allMetadata(): SecretRecord[] {
    return [...this.metadata.values()];
  }

  has(secretId: string): boolean {
    return this.secrets.has(secretId);
  }

  remove(secretId: string): void {
    this.secrets.delete(secretId);
    this.metadata.delete(secretId);
  }

  private requireKey(): Buffer {
    if (!this.key) throw new SecretVaultNotConfiguredError();
    return this.key;
  }
}
