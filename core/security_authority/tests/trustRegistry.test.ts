import { describe, expect, it } from 'vitest';
import { TrustRegistry } from '../src/trustRegistry.js';
import { DuplicateTrustError, TrustNotFoundError } from '../src/errors.js';
import type { TrustRegistrationInput } from '../src/types.js';

function makeInput(overrides: Partial<TrustRegistrationInput> = {}): TrustRegistrationInput {
  return {
    componentId: 'c1',
    componentType: 'authority',
    identity: 'Test Authority',
    trustLevel: 'basic',
    certificationStatus: 'uncertified',
    riskClassification: 'low',
    ...overrides,
  };
}

describe('TrustRegistry (§6, Law 2 — Zero Implicit Trust)', () => {
  it('registers a trust record with real timestamps and an honest default signatureStatus', () => {
    const registry = new TrustRegistry();
    const record = registry.register(makeInput());
    expect(record.signatureStatus).toBe('unsigned');
    expect(record.createdAt).toBeDefined();
    expect(record.lastValidation).toBeDefined();
  });

  it('rejects a duplicate componentId', () => {
    const registry = new TrustRegistry();
    registry.register(makeInput());
    expect(() => registry.register(makeInput())).toThrow(DuplicateTrustError);
  });

  it('require() throws for an unregistered component', () => {
    const registry = new TrustRegistry();
    expect(() => registry.require('missing')).toThrow(TrustNotFoundError);
  });

  it('revoke() sets trustLevel to untrusted and certificationStatus to revoked', () => {
    const registry = new TrustRegistry();
    registry.register(makeInput({ trustLevel: 'certified', certificationStatus: 'certified' }));
    const revoked = registry.revoke('c1');
    expect(revoked.trustLevel).toBe('untrusted');
    expect(revoked.certificationStatus).toBe('revoked');
  });

  it('get() returns undefined for an unregistered component — no implicit trust', () => {
    const registry = new TrustRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });
});
