import { describe, expect, it } from 'vitest';
import { assertBackupTransition, assertRecoveryTransition } from '../src/lifecycle.js';
import { InvalidBackupTransitionError, InvalidRecoveryTransitionError } from '../src/errors.js';

describe('assertBackupTransition() (§10)', () => {
  it('allows the full linear happy path', () => {
    expect(() => assertBackupTransition('created', 'validated')).not.toThrow();
    expect(() => assertBackupTransition('validated', 'stored')).not.toThrow();
    expect(() => assertBackupTransition('stored', 'verified')).not.toThrow();
    expect(() => assertBackupTransition('verified', 'available')).not.toThrow();
    expect(() => assertBackupTransition('available', 'archived')).not.toThrow();
    expect(() => assertBackupTransition('archived', 'expired')).not.toThrow();
    expect(() => assertBackupTransition('expired', 'purged')).not.toThrow();
  });

  it('allows failure from any non-terminal stage', () => {
    for (const from of ['created', 'validated', 'stored', 'verified', 'available'] as const) {
      expect(() => assertBackupTransition(from, 'failed')).not.toThrow();
    }
  });

  it('rejects skipping stages', () => {
    expect(() => assertBackupTransition('created', 'stored')).toThrow(InvalidBackupTransitionError);
  });

  it('rejects any transition out of a terminal stage', () => {
    expect(() => assertBackupTransition('purged', 'available')).toThrow(InvalidBackupTransitionError);
    expect(() => assertBackupTransition('failed', 'validated')).toThrow(InvalidBackupTransitionError);
  });
});

describe('assertRecoveryTransition() (§11)', () => {
  it('allows the full linear happy path', () => {
    expect(() => assertRecoveryTransition('requested', 'backup-selected')).not.toThrow();
    expect(() => assertRecoveryTransition('backup-selected', 'compatibility-verified')).not.toThrow();
    expect(() => assertRecoveryTransition('compatibility-verified', 'integrity-verified')).not.toThrow();
    expect(() => assertRecoveryTransition('integrity-verified', 'executed')).not.toThrow();
    expect(() => assertRecoveryTransition('executed', 'validated')).not.toThrow();
    expect(() => assertRecoveryTransition('validated', 'certified')).not.toThrow();
    expect(() => assertRecoveryTransition('certified', 'operational')).not.toThrow();
  });

  it('allows failure from any non-terminal stage', () => {
    for (const from of ['requested', 'backup-selected', 'compatibility-verified', 'integrity-verified', 'executed', 'validated', 'certified'] as const) {
      expect(() => assertRecoveryTransition(from, 'failed')).not.toThrow();
    }
  });

  it('rejects skipping stages', () => {
    expect(() => assertRecoveryTransition('requested', 'integrity-verified')).toThrow(InvalidRecoveryTransitionError);
  });

  it('rejects any transition out of a terminal stage', () => {
    expect(() => assertRecoveryTransition('operational', 'requested')).toThrow(InvalidRecoveryTransitionError);
  });
});
