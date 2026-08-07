import { ConfigurationRegistry, DEFAULT_ENTRIES } from './registry.js';
import { resolveConfigValues, type LoadOptions } from './sources.js';
import { validateAll } from './validate.js';
import { createSnapshot } from './snapshot.js';
import { CONFIG_EVENTS, ConfigEventBus, type ConfigEventName } from './events.js';
import { maskSensitiveValues, maskSingleValue } from './security.js';
import { AuditTrail } from './explainability.js';
import { ConfigurationError, ConfigurationValidationError } from './errors.js';
import type { ConfigCategory, ConfigSnapshot, ConfigValues } from './types.js';

export interface ConfigurationAuthorityOptions extends LoadOptions {
  /** Optional interim JSONL audit sink (see explainability.ts). */
  auditLogPath?: string;
}

/**
 * The Configuration Authority — institutional Single Source of Truth (PHASE-02).
 *
 * Pipeline (§4): sources → validation → immutable snapshot → read API.
 * No consumer reads configuration from disk, env, or CLI directly — only
 * through this class's read surface (get/getCategory/getSnapshot).
 */
export class ConfigurationAuthority {
  readonly registry = new ConfigurationRegistry();
  readonly events = new ConfigEventBus();
  readonly audit: AuditTrail;

  private currentSnapshot?: ConfigSnapshot;
  private lastValidSnapshot?: ConfigSnapshot;
  private snapshotVersion = 0;

  constructor(private readonly options: ConfigurationAuthorityOptions = {}) {
    this.registry.registerAll(DEFAULT_ENTRIES);
    this.audit = new AuditTrail(options.auditLogPath);
  }

  /** Loads from all sources, validates, and produces a new immutable snapshot. Fails fast on invalid startup config. */
  load(): ConfigSnapshot {
    const { values } = resolveConfigValues(this.registry, this.options);
    const result = validateAll(this.registry, values);

    if (!result.valid) {
      this.events.publish(CONFIG_EVENTS.Rejected, { errors: result.errors });

      if (this.lastValidSnapshot) {
        return this.lastValidSnapshot;
      }

      throw new ConfigurationValidationError(
        `Configuration Authority: startup rejected — ${result.errors.length} validation error(s).`,
        result.errors,
      );
    }

    this.events.publish(CONFIG_EVENTS.Validated, { keyCount: Object.keys(values).length });

    this.snapshotVersion += 1;
    const snapshot = createSnapshot(values, this.snapshotVersion);
    this.currentSnapshot = snapshot;
    this.lastValidSnapshot = snapshot;

    this.events.publish(CONFIG_EVENTS.SnapshotCreated, { version: snapshot.version });
    this.events.publish(CONFIG_EVENTS.Loaded, { version: snapshot.version });

    return snapshot;
  }

  reload(): ConfigSnapshot {
    const snapshot = this.load();
    this.events.publish(CONFIG_EVENTS.Reloaded, { version: snapshot.version });
    return snapshot;
  }

  getSnapshot(): ConfigSnapshot {
    if (!this.currentSnapshot) {
      throw new ConfigurationError(
        'CONFIGURATION_NOT_LOADED',
        'Configuration Authority has not been loaded. Call load() before reading configuration.',
      );
    }
    return this.currentSnapshot;
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

  /** Safe-to-log/telemetry/explain view of the current snapshot — sensitive values redacted (§11). */
  getMaskedSnapshot(): ConfigValues {
    return maskSensitiveValues(this.registry, this.getSnapshot().values as ConfigValues);
  }

  subscribe(event: ConfigEventName, handler: (payload: unknown) => void): () => void {
    return this.events.subscribe(event, handler);
  }

  /**
   * Approved update workflow (§9, §14) — the only mutation path exposed to
   * consumers. Immutable keys always reject. Every attempt (approved or
   * rejected) produces an audit record with sensitive values redacted.
   */
  requestUpdate(id: string, newValue: unknown, reason: string, initiatingAuthority: string): ConfigSnapshot {
    const entry = this.registry.require(id);

    if (entry.runtimeMutability === 'immutable') {
      throw new ConfigurationError('CONFIGURATION_IMMUTABLE', `"${id}" is immutable at runtime and cannot be updated.`);
    }

    const current = this.getSnapshot();
    const previousValue = current.values[id];
    const candidate: ConfigValues = { ...current.values, [id]: newValue };
    const result = validateAll(this.registry, candidate);

    const maskedPrevious = maskSingleValue(this.registry, id, previousValue);
    const maskedNext = maskSingleValue(this.registry, id, newValue);

    if (!result.valid) {
      this.audit.record({
        timestamp: new Date().toISOString(),
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
    this.currentSnapshot = snapshot;
    this.lastValidSnapshot = snapshot;

    this.audit.record({
      timestamp: new Date().toISOString(),
      id,
      previousValue: maskedPrevious,
      newValue: maskedNext,
      reason,
      initiatingAuthority,
      validationOutcome: 'valid',
      approvalStatus: 'approved',
    });

    this.events.publish(CONFIG_EVENTS.Updated, { id, version: snapshot.version });
    this.events.publish(CONFIG_EVENTS.SnapshotCreated, { version: snapshot.version });

    return snapshot;
  }
}
