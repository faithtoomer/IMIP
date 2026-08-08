import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';
import { RESILIENCE_EVENTS } from './types.js';
import type { ResilienceEventName } from './types.js';

const PUBLISHER_AUTHORITY = 'Backup, Recovery & Resilience Authority';

/** §14 — no existing EventCategory value fits ("database"/"storage" are
 * already owned by IDA/ISMA's own concerns; backup/recovery is a distinct
 * cross-cutting concept) — additive widening, the same precedent as
 * ISMA's `'storage'` (ADR-0012). See ADR-0017. */
const RESILIENCE_EVENT_DEFINITIONS: EventDefinition[] = Object.values(RESILIENCE_EVENTS).map((name) => ({
  id: `resilience.${name}`,
  name,
  category: 'resilience',
  description: `IBRRA event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: name === RESILIENCE_EVENTS.BackupFailed || name === RESILIENCE_EVENTS.RecoveryFailed ? 'critical' : 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));

/**
 * Publish/subscribe surface for IBRRA, bridged onto the Institutional Event
 * Bus (ADR-0009 §6 mirror pattern) — the same choice made for ISTA/INCA:
 * IBRRA's own public API stays synchronous so it can be called inline from
 * any other synchronous authority.
 */
export class ResilienceEventBus {
  private emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();

  constructor(private readonly iebBus?: InstitutionalEventBus) {
    if (this.iebBus) {
      for (const definition of RESILIENCE_EVENT_DEFINITIONS) {
        if (!this.iebBus.getEventDefinition(definition.name)) {
          this.iebBus.registerEventType(definition);
        }
      }
    }
  }

  publish(event: ResilienceEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
    if (this.iebBus) {
      this.lastMirrorPromise = this.iebBus.publish(event, PUBLISHER_AUTHORITY, payload).catch(() => {
        // Mirroring is observability, not a functional dependency.
      });
    }
  }

  subscribe(event: ResilienceEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }

  async flushMirror(): Promise<void> {
    await this.lastMirrorPromise;
  }
}
