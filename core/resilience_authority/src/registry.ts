import { BackupNotFoundError } from './errors.js';
import type { BackupRecord } from './types.js';

/** §7 — the authoritative Backup Registry. */
export class BackupRegistry {
  private backups = new Map<string, BackupRecord>();

  register(record: BackupRecord): void {
    this.backups.set(record.backupId, record);
  }

  update(record: BackupRecord): void {
    this.require(record.backupId);
    this.backups.set(record.backupId, record);
  }

  get(backupId: string): BackupRecord | undefined {
    return this.backups.get(backupId);
  }

  require(backupId: string): BackupRecord {
    const record = this.backups.get(backupId);
    if (!record) throw new BackupNotFoundError(backupId);
    return record;
  }

  all(): BackupRecord[] {
    return [...this.backups.values()];
  }

  latestVerified(): BackupRecord | undefined {
    return this.all()
      .filter((record) => record.verificationStatus === 'verified')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }
}
