import { describe, expect, it } from 'vitest';
import { VersionAuditTrail } from '../src/auditTrail.js';
import type { MigrationRecord, VersionRecord } from '../src/types.js';

function makeVersion(overrides: Partial<VersionRecord> = {}): VersionRecord {
  return {
    versionId: 'v1',
    artifactType: 'database-schema',
    artifactName: 'benchmark-results',
    semanticVersion: '1.0.0',
    status: 'created',
    ownerAuthority: 'X',
    certificationStatus: 'uncertified',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeMigration(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    migrationId: 'm1',
    artifactType: 'database-schema',
    sourceVersion: '1.0.0',
    targetVersion: '2.0.0',
    scope: 'benchmark-results',
    preconditions: [],
    verificationRequirements: [],
    rollbackStrategy: 'restore-from-backup',
    status: 'planned',
    steps: [],
    requestedBy: 'X',
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('VersionAuditTrail (§9/§14 — immutable audit history)', () => {
  it('records and lists version snapshots', () => {
    const trail = new VersionAuditTrail();
    trail.recordVersion(makeVersion());
    expect(trail.allVersionSnapshots()).toHaveLength(1);
  });

  it('versionHistory() filters by versionId, preserving every transition snapshot', () => {
    const trail = new VersionAuditTrail();
    trail.recordVersion(makeVersion({ status: 'created' }));
    trail.recordVersion(makeVersion({ status: 'registered' }));
    expect(trail.versionHistory('v1')).toHaveLength(2);
    expect(trail.versionHistory('v1').map((r) => r.status)).toEqual(['created', 'registered']);
  });

  it('records and lists migration snapshots', () => {
    const trail = new VersionAuditTrail();
    trail.recordMigration(makeMigration());
    expect(trail.allMigrationSnapshots()).toHaveLength(1);
  });

  it('migrationHistory() filters by migrationId', () => {
    const trail = new VersionAuditTrail();
    trail.recordMigration(makeMigration({ status: 'planned' }));
    trail.recordMigration(makeMigration({ status: 'validated' }));
    expect(trail.migrationHistory('m1')).toHaveLength(2);
  });

  it('snapshots are frozen — cannot be mutated after recording', () => {
    const trail = new VersionAuditTrail();
    trail.recordVersion(makeVersion());
    const [snapshot] = trail.allVersionSnapshots();
    expect(() => {
      (snapshot as { status: string }).status = 'purged';
    }).toThrow();
  });

  it('exposes no update or delete method (structural immutability)', () => {
    const trail = new VersionAuditTrail();
    expect((trail as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((trail as unknown as Record<string, unknown>).delete).toBeUndefined();
  });
});
