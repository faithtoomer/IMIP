import type { MigrationRecord, VersionRecord } from './types.js';

/** §9/§14 — "every transition is auditable" / "verification results are
 * permanently recorded," structurally immutable, mirroring every other
 * audit trail in this platform: no update or delete method exposed. */
export class VersionAuditTrail {
  private versionSnapshots: VersionRecord[] = [];
  private migrationSnapshots: MigrationRecord[] = [];

  recordVersion(record: VersionRecord): void {
    this.versionSnapshots.push(Object.freeze({ ...record }));
  }

  recordMigration(record: MigrationRecord): void {
    this.migrationSnapshots.push(Object.freeze({ ...record, steps: [...record.steps] }));
  }

  versionHistory(versionId: string): VersionRecord[] {
    return this.versionSnapshots.filter((snapshot) => snapshot.versionId === versionId);
  }

  migrationHistory(migrationId: string): MigrationRecord[] {
    return this.migrationSnapshots.filter((snapshot) => snapshot.migrationId === migrationId);
  }

  allVersionSnapshots(): readonly VersionRecord[] {
    return this.versionSnapshots;
  }

  allMigrationSnapshots(): readonly MigrationRecord[] {
    return this.migrationSnapshots;
  }
}
