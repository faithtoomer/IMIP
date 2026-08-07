import { EventEmitter } from 'node:events';

/** §10 — minimum published event set. */
export const CONFIG_EVENTS = {
  Loaded: 'ConfigurationLoaded',
  Validated: 'ConfigurationValidated',
  Rejected: 'ConfigurationRejected',
  Updated: 'ConfigurationUpdated',
  Reloaded: 'ConfigurationReloaded',
  SnapshotCreated: 'ConfigurationSnapshotCreated',
} as const;

export type ConfigEventName = (typeof CONFIG_EVENTS)[keyof typeof CONFIG_EVENTS];

/**
 * Interim publish/subscribe surface for the Configuration Authority.
 *
 * The institutional Event Bus (architecture/RUNTIME_ARCHITECTURE.md §6) is not yet
 * implemented. Until it is, this local emitter is the sole publish/subscribe channel
 * for Configuration Authority events. Its public surface (publish/subscribe) is
 * intentionally minimal so callers can be repointed at the real Event Bus later
 * without changing call sites.
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
