import { describe, expect, it } from 'vitest';
import { assertStorageTransition } from '../src/lifecycle.js';
import { InvalidStorageTransitionError } from '../src/errors.js';

describe('assertStorageTransition() (§12 — storage lifecycle)', () => {
  it('allows every legal forward transition', () => {
    expect(() => assertStorageTransition('allocated', 'active')).not.toThrow();
    expect(() => assertStorageTransition('active', 'archived')).not.toThrow();
    expect(() => assertStorageTransition('archived', 'retained')).not.toThrow();
    expect(() => assertStorageTransition('retained', 'expired')).not.toThrow();
    expect(() => assertStorageTransition('expired', 'deleted')).not.toThrow();
  });

  it('allows deletion from any non-terminal stage', () => {
    expect(() => assertStorageTransition('allocated', 'deleted')).not.toThrow();
    expect(() => assertStorageTransition('active', 'deleted')).not.toThrow();
    expect(() => assertStorageTransition('archived', 'deleted')).not.toThrow();
  });

  it('rejects skipping stages', () => {
    expect(() => assertStorageTransition('allocated', 'archived')).toThrow(InvalidStorageTransitionError);
    expect(() => assertStorageTransition('active', 'retained')).toThrow(InvalidStorageTransitionError);
  });

  it('rejects any transition out of deleted (terminal)', () => {
    expect(() => assertStorageTransition('deleted', 'active')).toThrow(InvalidStorageTransitionError);
  });

  it('rejects moving backward', () => {
    expect(() => assertStorageTransition('archived', 'active')).toThrow(InvalidStorageTransitionError);
  });
});
