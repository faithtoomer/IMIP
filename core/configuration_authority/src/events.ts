import { EventEmitter } from 'node:events';

/**
 * §16 — published event set. Names match the specification literally
 * (SnapshotCreated/Activated/RolledBack carry no "Configuration" prefix; the
 * rest do). ConfigurationReloaded is a non-conflicting convenience event, not
 * part of the minimum §16 list, fired in addition on explicit reload() calls.
 */
export const CONFIG_EVENTS = {
  Loaded: 'ConfigurationLoaded',
  Validated: 'ConfigurationValidated',
  Rejected: 'ConfigurationRejected',
  SnapshotCreated: 'SnapshotCreated',
  SnapshotActivated: 'SnapshotActivated',
  SnapshotRolledBack: 'SnapshotRolledBack',
  Changed: 'ConfigurationChanged',
  Migrated: 'ConfigurationMigrated',
  SecretResolved: 'SecretResolved',
  Reloaded: 'ConfigurationReloaded',
} as const;

export type ConfigEventName = (typeof CONFIG_EVENTS)[keyof typeof CONFIG_EVENTS];

/**
 * Interim publish/subscribe surface for ICMS.
 *
 * The institutional Event Bus (architecture/RUNTIME_ARCHITECTURE.md §6) is not yet
 * implemented. Until it is, this local emitter is the sole publish/subscribe channel
 * for ICMS events. Its public surface (publish/subscribe) is intentionally minimal
 * so callers can be repointed at the real Event Bus later without changing call sites.
 */
export class ConfigEventBus {
  private emitter = new EventEmitter();

  publish(event: ConfigEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
  }

  subscribe(event: ConfigEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }
}
