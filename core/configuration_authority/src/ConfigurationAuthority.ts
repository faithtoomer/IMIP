import { ConfigurationRegistry, DEFAULT_ENTRIES, CURRENT_SCHEMA_VERSION } from './registry.js';
import { resolveConfigValues, type LoadOptions } from './sources.js';
import { runValidationPipeline } from './pipeline.js';
import { CompatibilityRegistry } from './compatibility.js';
import { createSnapshot, SnapshotStore } from './snapshot.js';
import { CONFIG_EVENTS, ConfigEventBus, type ConfigEventName } from './events.js';
import { maskSensitiveValues, maskSingleValue, shouldMask } from './security.js';
import { AuditTrail } from './explainability.js';
import { ProvenanceStore } from './provenance.js';
import { MigrationRunner, DEFAULT_MIGRATIONS } from './migrations.js';
import {
  ConfigurationError,
  ConfigurationSyntaxError,
  ConfigurationValidationError,
} from './errors.js';
import type {
  ConfigCategory,
  ConfigEntry,
  ConfigSnapshot,
  ConfigValues,
  MigrationDefinition,
  ProvenanceRecord,
  VersionInfo,
} from './types.js';

export interface ConfigurationAuthorityOptions extends LoadOptions {
  /** Optional interim JSONL audit sink (see explainability.ts). */
  auditLogPath?: string;
  /** Migrations to run on load; defaults to the platform's registered set (empty — see migrations.ts). */
  migrations?: MigrationDefinition[];
  /** ICMS's own schema version for this run. Defaults to the current registry schema version. */
  schemaVersion?: string;
}

/**
 * ICMS — the Institutional Configuration Management System (PHASE-02).
 *
 * Pipeline (§5): sources → secret resolution → migration → 9-stage validation
 * → immutable, content-addressed snapshot → activation → provenance → read API.
 * No consumer reads configuration from disk, env, or CLI directly — only
 * through this class's read surface.
 */
export class ConfigurationAuthority {
  readonly registry = new ConfigurationRegistry();
  readonly events = new ConfigEventBus();
  readonly audit: AuditTrail;
  readonly provenance = new ProvenanceStore();
  readonly snapshots = new SnapshotStore();
  readonly hardwareCompatibility = new CompatibilityRegistry();
  readonly policyCompatibility = new CompatibilityRegistry();

  private readonly migrationRunner: MigrationRunner;
  private readonly schemaVersion: string;
  private snapshotVersion = 0;
  private lastValidSnapshot?: ConfigSnapshot;
  private lastAppliedMigrationId = 'none';

  constructor(private readonly options: ConfigurationAuthorityOptions = {}) {
    this.registry.registerAll(DEFAULT_ENTRIES);
    this.audit = new AuditTrail(options.auditLogPath);
    this.migrationRunner = new MigrationRunner(options.migrations ?? DEFAULT_MIGRATIONS);
    this.schemaVersion = options.schemaVersion ?? CURRENT_SCHEMA_VERSION;
  }

  /** Loads from all sources, migrates, validates, and produces a new immutable, activated snapshot. */
  load(): ConfigSnapshot {
    let resolved: ReturnType<typeof resolveConfigValues>;
    try {
      resolved = resolveConfigValues(this.registry, this.options);
    } catch (error) {
      if (error instanceof ConfigurationSyntaxError) {
        const syntaxError = { id: '__syntax__', message: error.message };
        const result = runValidationPipeline(
          this.registry,
          {},
          { hardware: this.hardwareCompatibility, policy: this.policyCompatibility },
          { syntaxError },
        );
        this.events.publish(CONFIG_EVENTS.Rejected, { errors: result.errors });
        if (this.lastValidSnapshot) return this.lastValidSnapshot;
        throw new ConfigurationValidationError(`ICMS: startup rejected — ${error.message}`, result.errors);
      }
      throw error;
    }

    const { values, resolution } = resolved;

    for (const item of resolution) {
      if (item.source !== 'secrets') continue;
      this.events.publish(CONFIG_EVENTS.SecretResolved, { id: item.id });
    }

    const migration = this.migrationRunner.run(values, this.schemaVersion);
    if (migration.applied.length > 0) {
      this.events.publish(CONFIG_EVENTS.Migrated, { applied: migration.applied });
      this.lastAppliedMigrationId = migration.applied[migration.applied.length - 1].migrationId;
    }

    const result = runValidationPipeline(this.registry, migration.values, {
      hardware: this.hardwareCompatibility,
      policy: this.policyCompatibility,
    });

    if (!result.valid) {
      this.events.publish(CONFIG_EVENTS.Rejected, { errors: result.errors });
      if (this.lastValidSnapshot) return this.lastValidSnapshot;
      throw new ConfigurationValidationError(
        `ICMS: startup rejected — ${result.errors.length} validation error(s).`,
        result.errors,
      );
    }

    this.events.publish(CONFIG_EVENTS.Validated, { keyCount: Object.keys(migration.values).length });

    this.snapshotVersion += 1;
    const snapshot = createSnapshot(migration.values, this.snapshotVersion);
    this.snapshots.activate(snapshot);
    this.lastValidSnapshot = snapshot;

    this.events.publish(CONFIG_EVENTS.SnapshotCreated, { version: snapshot.version, id: snapshot.id });
    this.events.publish(CONFIG_EVENTS.SnapshotActivated, { version: snapshot.version, id: snapshot.id });

    const resolutionById = new Map(resolution.map((r) => [r.id, r]));
    for (const entry of this.registry.all()) {
      this.provenance.recordLoad(
        entry.id,
        snapshot.values[entry.id],
        resolutionById.get(entry.id)?.source ?? 'default',
        entry.owner,
        snapshot.version,
      );
    }
    for (const record of migration.applied) {
      for (const key of record.affectedKeys) {
        this.provenance.recordMigration(key, {
          migrationId: record.migrationId,
          timestamp: record.timestamp,
          fromValue: undefined,
          toValue: snapshot.values[key],
        });
      }
    }

    this.events.publish(CONFIG_EVENTS.Loaded, { version: snapshot.version });

    return snapshot;
  }

  reload(): ConfigSnapshot {
    const snapshot = this.load();
    this.events.publish(CONFIG_EVENTS.Reloaded, { version: snapshot.version });
    return snapshot;
  }

  getSnapshot(): ConfigSnapshot {
    const current = this.snapshots.current();
    if (!current) {
      throw new ConfigurationError(
        'CONFIGURATION_NOT_LOADED',
        'ICMS has not been loaded. Call load() before reading configuration.',
      );
    }
    return current;
  }

  get(id: string): unknown {
    this.registry.require(id);
    return this.getSnapshot().values[id];
  }

  getCategory(category: ConfigCategory): ConfigValues {
    const snapshot = this.getSnapshot();
    const out: ConfigValues = {};
    for (const entry of this.registry.byCategory(category)) {
      out[entry.id] = snapshot.values[entry.id];
    }
    return out;
  }

  /** Safe-to-log/telemetry/explain view of the current snapshot — masked values redacted (§13). */
  getMaskedSnapshot(): ConfigValues {
    return maskSensitiveValues(this.registry, this.getSnapshot().values as ConfigValues);
  }

  getSchema(id: string): ConfigEntry {
    return this.registry.require(id);
  }

  getSchemaAll(): ConfigEntry[] {
    return this.registry.all();
  }

  /** Masked provenance view (§12, §17). */
  getProvenance(id: string): ProvenanceRecord | undefined {
    const entry = this.registry.require(id);
    const record = this.provenance.get(id);
    if (!record) return undefined;
    if (!shouldMask(entry.securityClassification)) return record;

    return {
      ...record,
      currentValue: maskSingleValue(this.registry, id, record.currentValue),
      overrideHistory: record.overrideHistory.map((o) => ({
        ...o,
        previousValue: maskSingleValue(this.registry, id, o.previousValue),
        newValue: maskSingleValue(this.registry, id, o.newValue),
      })),
      migrationHistory: record.migrationHistory.map((m) => ({
        ...m,
        fromValue: maskSingleValue(this.registry, id, m.fromValue),
        toValue: maskSingleValue(this.registry, id, m.toValue),
      })),
    };
  }

  getVersionInfo(): VersionInfo {
    return {
      schemaVersion: this.schemaVersion,
      runtimeVersion: String(this.get('platform.version')),
      compatibilityVersion: '1.0.0',
      migrationVersion: this.lastAppliedMigrationId,
    };
  }

  subscribe(event: ConfigEventName, handler: (payload: unknown) => void): () => void {
    return this.events.subscribe(event, handler);
  }

  /**
   * Approved update workflow (§11, §17) — the only mutation path exposed to
   * consumers. Immutable keys always reject. Every attempt (approved or
   * rejected) produces an audit record and, on success, a provenance override
   * entry — both with masked values for confidential/restricted/secret keys.
   */
  requestUpdate(id: string, newValue: unknown, reason: string, initiatingAuthority: string): ConfigSnapshot {
    const entry = this.registry.require(id);

    if (entry.runtimeMutability === 'immutable') {
      throw new ConfigurationError('CONFIGURATION_IMMUTABLE', `"${id}" is immutable at runtime and cannot be updated.`);
    }

    const current = this.getSnapshot();
    const previousValue = current.values[id];
    const candidate: ConfigValues = { ...current.values, [id]: newValue };
    const result = runValidationPipeline(this.registry, candidate, {
      hardware: this.hardwareCompatibility,
      policy: this.policyCompatibility,
    });

    const maskedPrevious = maskSingleValue(this.registry, id, previousValue);
    const maskedNext = maskSingleValue(this.registry, id, newValue);
    const timestamp = new Date().toISOString();

    if (!result.valid) {
      this.audit.record({
        timestamp,
        id,
        previousValue: maskedPrevious,
        newValue: maskedNext,
        reason,
        initiatingAuthority,
        validationOutcome: 'invalid',
        approvalStatus: 'rejected',
      });
      this.events.publish(CONFIG_EVENTS.Rejected, { id, errors: result.errors.filter((e) => e.id === id) });
      throw new ConfigurationValidationError(`Configuration update rejected for "${id}".`, result.errors);
    }

    this.snapshotVersion += 1;
    const snapshot = createSnapshot(candidate, this.snapshotVersion);
    this.snapshots.activate(snapshot);
    this.lastValidSnapshot = snapshot;

    this.audit.record({
      timestamp,
      id,
      previousValue: maskedPrevious,
      newValue: maskedNext,
      reason,
      initiatingAuthority,
      validationOutcome: 'valid',
      approvalStatus: 'approved',
    });

    this.provenance.recordOverride(
      id,
      { timestamp, previousValue: maskedPrevious, newValue: maskedNext, reason, initiatingAuthority },
      snapshot.version,
    );

    this.events.publish(CONFIG_EVENTS.Changed, { id, version: snapshot.version });
    this.events.publish(CONFIG_EVENTS.SnapshotCreated, { version: snapshot.version, id: snapshot.id });
    this.events.publish(CONFIG_EVENTS.SnapshotActivated, { version: snapshot.version, id: snapshot.id });

    return snapshot;
  }

  /** Reactivates a prior snapshot from history (§11 rollback). Does not delete or rewrite history. */
  rollback(version: number, reason: string, initiatingAuthority: string): ConfigSnapshot {
    const fromVersion = this.getSnapshot().version;
    const target = this.snapshots.rollbackTo(version);
    this.lastValidSnapshot = target;

    this.audit.record({
      timestamp: new Date().toISOString(),
      id: '__snapshot__',
      previousValue: fromVersion,
      newValue: version,
      reason,
      initiatingAuthority,
      validationOutcome: 'valid',
      approvalStatus: 'approved',
    });

    this.events.publish(CONFIG_EVENTS.SnapshotRolledBack, { fromVersion, toVersion: version });

    return target;
  }
}
