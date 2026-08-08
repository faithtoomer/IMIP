import { describe, expect, it } from 'vitest';
import { InstitutionalRecoveryGraph } from '../src/recoveryGraph.js';
import { RecoveryPointNotFoundError } from '../src/errors.js';
import type { RecoveryPoint } from '../src/types.js';

function makePoint(overrides: Partial<RecoveryPoint> = {}): RecoveryPoint {
  return {
    recoveryPointId: 'rp1',
    backupId: 'b1',
    platformVersion: '1.0.0',
    domainSchemaVersions: { 'benchmark-results': 1 },
    createdAt: new Date().toISOString(),
    verificationStatus: 'verified',
    ...overrides,
  };
}

describe('InstitutionalRecoveryGraph (§23 — the Institutional Recovery Graph)', () => {
  it('registers and retrieves a recovery point', () => {
    const graph = new InstitutionalRecoveryGraph();
    graph.registerRecoveryPoint(makePoint());
    expect(graph.get('rp1')?.recoveryPointId).toBe('rp1');
  });

  it('require() throws for an unregistered recovery point', () => {
    const graph = new InstitutionalRecoveryGraph();
    expect(() => graph.require('missing')).toThrow(RecoveryPointNotFoundError);
  });

  it('compatibleWith() finds only verified recovery points matching the platform version', () => {
    const graph = new InstitutionalRecoveryGraph();
    graph.registerRecoveryPoint(makePoint({ recoveryPointId: 'a', platformVersion: '1.0.0', verificationStatus: 'verified' }));
    graph.registerRecoveryPoint(makePoint({ recoveryPointId: 'b', platformVersion: '2.0.0', verificationStatus: 'verified' }));
    graph.registerRecoveryPoint(makePoint({ recoveryPointId: 'c', platformVersion: '1.0.0', verificationStatus: 'failed' }));
    expect(graph.compatibleWith('1.0.0').map((p) => p.recoveryPointId)).toEqual(['a']);
  });

  it('diff() reports real schema-version changes between two recovery points', () => {
    const graph = new InstitutionalRecoveryGraph();
    graph.registerRecoveryPoint(makePoint({ recoveryPointId: 'a', domainSchemaVersions: { x: 1, y: 1 } }));
    graph.registerRecoveryPoint(makePoint({ recoveryPointId: 'b', domainSchemaVersions: { x: 2, y: 1, z: 1 } }));
    const delta = graph.diff('a', 'b');
    expect(delta.domainSchemaChanges).toEqual([
      { domain: 'x', from: 1, to: 2 },
      { domain: 'z', from: undefined, to: 1 },
    ]);
  });

  it('diff() reports whether the platform version changed', () => {
    const graph = new InstitutionalRecoveryGraph();
    graph.registerRecoveryPoint(makePoint({ recoveryPointId: 'a', platformVersion: '1.0.0' }));
    graph.registerRecoveryPoint(makePoint({ recoveryPointId: 'b', platformVersion: '1.1.0' }));
    expect(graph.diff('a', 'b').platformVersionChanged).toBe(true);
  });

  it('requiresMigration() detects a real schema-version mismatch against the current platform', () => {
    const graph = new InstitutionalRecoveryGraph();
    graph.registerRecoveryPoint(makePoint({ domainSchemaVersions: { 'benchmark-results': 1 } }));
    expect(graph.requiresMigration('rp1', { 'benchmark-results': 2 })).toBe(true);
    expect(graph.requiresMigration('rp1', { 'benchmark-results': 1 })).toBe(false);
  });

  it('requiresMigration() ignores domains the current platform does not track', () => {
    const graph = new InstitutionalRecoveryGraph();
    graph.registerRecoveryPoint(makePoint({ domainSchemaVersions: { 'legacy-domain': 1 } }));
    expect(graph.requiresMigration('rp1', {})).toBe(false);
  });
});
