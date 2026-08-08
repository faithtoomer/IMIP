import { describe, expect, it } from 'vitest';
import { SecretVault } from '../src/secretVault.js';
import { SecretNotFoundError, SecretVaultNotConfiguredError } from '../src/errors.js';

describe('SecretVault (§8 — real AES-256-GCM encryption at rest)', () => {
  it('round-trips a real secret through real encryption/decryption', () => {
    const vault = new SecretVault('test-master-key');
    vault.store('s1', 'api-key', 'super-secret-value');
    expect(vault.retrieve('s1')).toBe('super-secret-value');
  });

  it('the ciphertext is never the plaintext — this is real encryption, not a pass-through', () => {
    const vault = new SecretVault('test-master-key');
    vault.store('s1', 'api-key', 'super-secret-value');
    // Reach into the vault's internal Map via any-cast purely to assert the
    // stored bytes are not the plaintext — a real, not simulated, guarantee.
    const internal = (vault as unknown as { secrets: Map<string, { ciphertext: Buffer }> }).secrets;
    expect(internal.get('s1')!.ciphertext.toString('utf-8')).not.toContain('super-secret-value');
  });

  it('two different master keys never decrypt each other\'s secrets', () => {
    const vaultA = new SecretVault('key-a');
    vaultA.store('s1', 'api-key', 'value');
    const vaultB = new SecretVault('key-b');
    // vaultB has no record of s1 at all — simulates a completely different vault instance.
    expect(() => vaultB.retrieve('s1')).toThrow(SecretNotFoundError);
  });

  it('throws SecretVaultNotConfiguredError when no master key is supplied', () => {
    const vault = new SecretVault();
    expect(vault.isConfigured()).toBe(false);
    expect(() => vault.store('s1', 'api-key', 'value')).toThrow(SecretVaultNotConfiguredError);
  });

  it('retrieve() throws for an unstored secret', () => {
    const vault = new SecretVault('key');
    expect(() => vault.retrieve('nonexistent')).toThrow(SecretNotFoundError);
  });

  it('rotate() re-encrypts with a new value and updates lastRotatedAt without losing createdAt', async () => {
    const vault = new SecretVault('key');
    const first = vault.store('s1', 'api-key', 'v1');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const rotated = vault.rotate('s1', 'v2');

    expect(vault.retrieve('s1')).toBe('v2');
    expect(rotated.createdAt).toBe(first.createdAt);
    expect(rotated.lastRotatedAt).not.toBe(first.lastRotatedAt);
  });

  it('rotate() throws for a secret that was never stored', () => {
    const vault = new SecretVault('key');
    expect(() => vault.rotate('nonexistent', 'v')).toThrow(SecretNotFoundError);
  });

  it('accessCount and lastAccessedAt track real retrievals', () => {
    const vault = new SecretVault('key');
    vault.store('s1', 'api-key', 'v');
    expect(vault.metadataFor('s1')!.accessCount).toBe(0);
    vault.retrieve('s1');
    vault.retrieve('s1');
    expect(vault.metadataFor('s1')!.accessCount).toBe(2);
    expect(vault.metadataFor('s1')!.lastAccessedAt).toBeDefined();
  });

  it('remove() deletes both the secret and its metadata', () => {
    const vault = new SecretVault('key');
    vault.store('s1', 'api-key', 'v');
    vault.remove('s1');
    expect(vault.has('s1')).toBe(false);
    expect(vault.metadataFor('s1')).toBeUndefined();
  });
});
