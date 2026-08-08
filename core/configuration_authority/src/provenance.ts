import type {
  ConfigSourceName,
  ConfigValues,
  ProvenanceMigration,
  ProvenanceOverride,
  ProvenanceRecord,
} from './types.js';

/**
 * §12 — per-key configuration provenance. Every value can answer: what is it,
 * who owns it, where did it originate, why is it active, when was it loaded,
 * which snapshot contains it, and its full override/migration history.
 * Permanently retained (append-only) for auditing.
 */
export class ProvenanceStore {
  private records = new Map<string, ProvenanceRecord>();

  private ensure(id: string, ownerAuthority: string): ProvenanceRecord {
    let record = this.records.get(id);
    if (!record) {
      record = {
        id,
        currentValue: undefined,
        originalSource: 'default',
        ownerAuthority,
        validationTimestamp: new Date(0).toISOString(),
        snapshotVersion: 0,
        overrideHistory: [],
        migrationHistory: [],
        lastModified: new Date(0).toISOString(),
        validationResult: 'valid',
      };
      this.records.set(id, record);
    }
    return record;
  }

  /** Called once per load()/reload() for every registered key. */
  recordLoad(
    id: string,
    value: unknown,
    source: ConfigSourceName,
    ownerAuthority: string,
    snapshotVersion: number,
  ): void {
    const record = this.ensure(id, ownerAuthority);
    record.currentValue = value;
    record.originalSource = source;
    record.ownerAuthority = ownerAuthority;
    record.validationTimestamp = new Date().toISOString();
    record.snapshotVersion = snapshotVersion;
    record.validationResult = 'valid';
  }

  /** Called on a successful requestUpdate(). */
  recordOverride(id: string, override: ProvenanceOverride, snapshotVersion: number): void {
    const record = this.records.get(id);
    if (!record) throw new Error(`Cannot record override for unknown provenance key "${id}". Call recordLoad() first.`);
    record.overrideHistory.push(Object.freeze({ ...override }));
    record.currentValue = override.newValue;
    record.lastModified = override.timestamp;
    record.snapshotVersion = snapshotVersion;
  }

  /** Called when a migration mutates a key's value during load(). */
  recordMigration(id: string, migration: ProvenanceMigration): void {
    const record = this.records.get(id);
    if (!record) return; // migration touched a key not (yet) in this load's value set
    record.migrationHistory.push(Object.freeze({ ...migration }));
  }

  get(id: string): ProvenanceRecord | undefined {
    return this.records.get(id);
  }

  all(): ConfigValues {
    return Object.fromEntries(this.records.entries());
  }
}
