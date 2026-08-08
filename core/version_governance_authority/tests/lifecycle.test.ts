import { describe, expect, it } from 'vitest';
import { assertMigrationTransition, assertVersionTransition } from '../src/lifecycle.js';
import { InvalidMigrationTransitionError, InvalidVersionTransitionError } from '../src/errors.js';

describe('assertVersionTransition() (§9)', () => {
  it('allows the full linear happy path', () => {
    expect(() => assertVersionTransition('created', 'registered')).not.toThrow();
    expect(() => assertVersionTransition('registered', 'certified')).not.toThrow();
    expect(() => assertVersionTransition('certified', 'released')).not.toThrow();
    expect(() => assertVersionTransition('released', 'supported')).not.toThrow();
    expect(() => assertVersionTransition('supported', 'deprecated')).not.toThrow();
    expect(() => assertVersionTransition('deprecated', 'retired')).not.toThrow();
  });

  it('allows certification to be rejected instead of certified', () => {
    expect(() => assertVersionTransition('registered', 'rejected')).not.toThrow();
  });

  it('rejects skipping stages', () => {
    expect(() => assertVersionTransition('created', 'certified')).toThrow(InvalidVersionTransitionError);
  });

  it('rejects any transition out of a terminal stage', () => {
    expect(() => assertVersionTransition('retired', 'supported')).toThrow(InvalidVersionTransitionError);
    expect(() => assertVersionTransition('rejected', 'registered')).toThrow(InvalidVersionTransitionError);
  });
});

describe('assertMigrationTransition() (§10, Law 4)', () => {
  it('allows the full linear happy path to certified', () => {
    expect(() => assertMigrationTransition('planned', 'validated')).not.toThrow();
    expect(() => assertMigrationTransition('validated', 'compatibility-verified')).not.toThrow();
    expect(() => assertMigrationTransition('compatibility-verified', 'executed')).not.toThrow();
    expect(() => assertMigrationTransition('executed', 'verified')).not.toThrow();
    expect(() => assertMigrationTransition('verified', 'certified')).not.toThrow();
  });

  it('allows rollback from any in-progress stage', () => {
    for (const from of ['validated', 'compatibility-verified', 'executed', 'verified'] as const) {
      expect(() => assertMigrationTransition(from, 'rollback')).not.toThrow();
    }
  });

  it('rollback resolves to either rolled-back or failed', () => {
    expect(() => assertMigrationTransition('rollback', 'rolled-back')).not.toThrow();
    expect(() => assertMigrationTransition('rollback', 'failed')).not.toThrow();
  });

  it('rejects skipping stages', () => {
    expect(() => assertMigrationTransition('planned', 'executed')).toThrow(InvalidMigrationTransitionError);
  });

  it('rejects any transition out of a terminal stage', () => {
    expect(() => assertMigrationTransition('certified', 'rollback')).toThrow(InvalidMigrationTransitionError);
    expect(() => assertMigrationTransition('rolled-back', 'planned')).toThrow(InvalidMigrationTransitionError);
    expect(() => assertMigrationTransition('failed', 'rollback')).toThrow(InvalidMigrationTransitionError);
  });
});
