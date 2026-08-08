import { describe, expect, it } from 'vitest';
import { ResilienceAuditTrail } from '../src/auditTrail.js';
import type { BackupRecord, RecoveryRecord } from '../src/types.js';

function makeBackup(overrides: Partial<BackupRecord> = {}): BackupRecord {
  return {
    backupId: 'b1',
    backupType: 'full',
    domains: [],
    createdAt: new Date().toISOString(),
    storageLocation: '/tmp/x',
    totalSizeBytes: 0,
    encryptionStatus: 'none',
    verificationStatus: 'unverified',
    recoveryCompatibilityVersion: 'unknown',
    status: 'created',
    ...overrides,
  };
}

function makeRecovery(overrides: Partial<RecoveryRecord> = {}): RecoveryRecord {
  return {
    recoveryId: 'r1',
    backupId: 'b1',
    requestedBy: 'X',
    reason: 'test',
    status: 'requested',
    steps: [],
    domainResults: [],
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ResilienceAuditTrail (§10/§12 — immutable audit history)', () => {
  it('records and lists backup snapshots', () => {
    const trail = new ResilienceAuditTrail();
    trail.recordBackup(makeBackup());
    expect(trail.allBackupSnapshots()).toHaveLength(1);
  });

  it('backupHistory() filters by backupId, preserving every transition snapshot', () => {
    const trail = new ResilienceAuditTrail();
    trail.recordBackup(makeBackup({ status: 'created' }));
    trail.recordBackup(makeBackup({ status: 'validated' }));
    expect(trail.backupHistory('b1')).toHaveLength(2);
    expect(trail.backupHistory('b1').map((r) => r.status)).toEqual(['created', 'validated']);
  });

  it('records and lists recovery snapshots', () => {
    const trail = new ResilienceAuditTrail();
    trail.recordRecovery(makeRecovery());
    expect(trail.allRecoverySnapshots()).toHaveLength(1);
  });

  it('recoveryHistory() filters by recoveryId', () => {
    const trail = new ResilienceAuditTrail();
    trail.recordRecovery(makeRecovery({ status: 'requested' }));
    trail.recordRecovery(makeRecovery({ status: 'operational' }));
    expect(trail.recoveryHistory('r1')).toHaveLength(2);
  });

  it('snapshots are frozen — cannot be mutated after recording', () => {
    const trail = new ResilienceAuditTrail();
    trail.recordBackup(makeBackup());
    const [snapshot] = trail.allBackupSnapshots();
    expect(() => {
      (snapshot as { status: string }).status = 'purged';
    }).toThrow();
  });

  it('exposes no update or delete method (structural immutability)', () => {
    const trail = new ResilienceAuditTrail();
    expect((trail as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((trail as unknown as Record<string, unknown>).delete).toBeUndefined();
  });
});
