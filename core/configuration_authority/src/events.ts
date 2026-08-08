import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';

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

const PUBLISHER_AUTHORITY = 'Configuration Authority';

/** Event catalog mirrored onto the IEB (ADR-0009). Async/broadcast: mirroring is
 * best-effort observability, never a blocking or ownership-gating concern for
 * ICMS's own local delivery. */
const CONFIG_EVENT_DEFINITIONS: EventDefinition[] = Object.values(CONFIG_EVENTS).map((name) => ({
  id: `configuration.${name}`,
  name,
  category: 'configuration',
  description: `ICMS event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));

/**
 * Publish/subscribe surface for ICMS, bridged onto the Institutional Event Bus
 * (PHASE-05, ADR-0009).
 *
 * Local delivery (this class's own `emitter`) remains the primary mechanism and
 * is unchanged: `publish()` and `subscribe()` keep their exact synchronous
 * behavior and signatures, so ConfigurationAuthority's public API (load(),
 * requestUpdate(), etc.) stays synchronous and no existing call site changes.
 *
 * When an `InstitutionalEventBus` is supplied, every publish is additionally
 * mirrored onto it (fire-and-forget) after registering ICMS's event catalog
 * there under its own authority. This makes ICMS's events discoverable,
 * audited, and subscribable platform-wide through the IEB — without ICMS
 * itself becoming async or losing its own synchronous delivery guarantee.
 */
export class ConfigEventBus {
  private emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();

  constructor(private readonly iebBus?: InstitutionalEventBus) {
    if (this.iebBus) {
      for (const definition of CONFIG_EVENT_DEFINITIONS) {
        if (!this.iebBus.getEventDefinition(definition.name)) {
          this.iebBus.registerEventType(definition);
        }
      }
    }
  }

  publish(event: ConfigEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
    if (this.iebBus) {
      this.lastMirrorPromise = this.iebBus.publish(event, PUBLISHER_AUTHORITY, payload).catch(() => {
        // Mirroring is observability, not a functional dependency — a mirror
        // failure must never affect ICMS's own local event delivery.
      });
    }
  }

  subscribe(event: ConfigEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }

  /** Test/diagnostic hook: resolves once the most recent mirror publish has settled. */
  async flushMirror(): Promise<void> {
    await this.lastMirrorPromise;
  }
}
