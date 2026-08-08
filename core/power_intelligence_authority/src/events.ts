import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';
import { POWER_EVENTS } from './types.js';
import type { PowerEventName } from './types.js';

const PUBLISHER_AUTHORITY = 'Power Intelligence Authority';

/** §14/ADR-0019 — unlike every prior phase, `'power'` is already a real,
 * reserved `EventCategory` (part of the original Phase 01 union) with zero
 * current producers — no additive widening needed. */
const POWER_EVENT_DEFINITIONS: EventDefinition[] = Object.values(POWER_EVENTS).map((name) => ({
  id: `power.${name}`,
  name,
  category: 'power',
  description: `IPIA event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: name === POWER_EVENTS.BudgetExceeded || name === POWER_EVENTS.SensorUnavailable ? 'high' : 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));

/**
 * Publish/subscribe surface for IPIA, bridged onto the Institutional Event
 * Bus (ADR-0009 §6 mirror pattern) — the same choice made for every
 * synchronous-API authority since ISTA/INCA/IBRRA/IVGMA.
 */
export class PowerEventBus {
  private emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();

  constructor(private readonly iebBus?: InstitutionalEventBus) {
    if (this.iebBus) {
      for (const definition of POWER_EVENT_DEFINITIONS) {
        if (!this.iebBus.getEventDefinition(definition.name)) {
          this.iebBus.registerEventType(definition);
        }
      }
    }
  }

  publish(event: PowerEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
    if (this.iebBus) {
      this.lastMirrorPromise = this.iebBus.publish(event, PUBLISHER_AUTHORITY, payload).catch(() => {
        // Mirroring is observability, not a functional dependency.
      });
    }
  }

  subscribe(event: PowerEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }

  async flushMirror(): Promise<void> {
    await this.lastMirrorPromise;
  }
}
