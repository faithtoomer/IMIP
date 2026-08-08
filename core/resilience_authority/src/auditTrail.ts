import type { BackupRecord, RecoveryRecord } from './types.js';

/** §10/§12 — "every transition is auditable" / "verification results
 * remain permanently recorded," structurally immutable, mirroring every
 * other audit trail in this platform: no update or delete method is
 * exposed, for any reason. */
export class ResilienceAuditTrail {
  private backupSnapshots: BackupRecord[] = [];
  private recoverySnapshots: RecoveryRecord[] = [];

  recordBackup(record: BackupRecord): void {
    this.backupSnapshots.push(Object.freeze({ ...record, domains: [...record.domains] }));
  }

  recordRecovery(record: RecoveryRecord): void {
    this.recoverySnapshots.push(Object.freeze({ ...record, steps: [...record.steps], domainResults: [...record.domainResults] }));
  }

  backupHistory(backupId: string): BackupRecord[] {
    return this.backupSnapshots.filter((snapshot) => snapshot.backupId === backupId);
  }

  recoveryHistory(recoveryId: string): RecoveryRecord[] {
    return this.recoverySnapshots.filter((snapshot) => snapshot.recoveryId === recoveryId);
  }

  allBackupSnapshots(): readonly BackupRecord[] {
    return this.backupSnapshots;
  }

  allRecoverySnapshots(): readonly RecoveryRecord[] {
    return this.recoverySnapshots;
  }
}
