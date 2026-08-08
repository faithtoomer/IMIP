import { MigrationNotFoundError } from './errors.js';
import type { MigrationRecord } from './types.js';

/** §8 — "The Migration Registry is immutable": once a migration record is
 * registered, its identity fields never change; only its lifecycle state
 * (via replacing the map entry with an updated snapshot) progresses
 * forward through the real transition table in lifecycle.ts. Every
 * intermediate state is separately preserved in ResilienceAuditTrail-style
 * fashion via the orchestrator's own audit trail. */
export class MigrationRegistry {
  private migrations = new Map<string, MigrationRecord>();

  register(record: MigrationRecord): void {
    this.migrations.set(record.migrationId, record);
  }

  update(record: MigrationRecord): void {
    this.require(record.migrationId);
    this.migrations.set(record.migrationId, record);
  }

  get(migrationId: string): MigrationRecord | undefined {
    return this.migrations.get(migrationId);
  }

  require(migrationId: string): MigrationRecord {
    const record = this.migrations.get(migrationId);
    if (!record) throw new MigrationNotFoundError(migrationId);
    return record;
  }

  byArtifactType(artifactType: string): MigrationRecord[] {
    return this.all().filter((record) => record.artifactType === artifactType);
  }

  all(): MigrationRecord[] {
    return [...this.migrations.values()];
  }
}
