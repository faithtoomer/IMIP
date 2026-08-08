import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';

/** §8 — IHIA's published health event set. All are registered in the existing generic `health` category. */
export const HEALTH_EVENTS = {
  HealthUpdated: 'HealthUpdated',
  HealthWarning: 'HealthWarning',
  HealthCritical: 'HealthCritical',
  HealthRecovered: 'HealthRecovered',
  FailurePredicted: 'FailurePredicted',
  ReliabilityUpdated: 'ReliabilityUpdated',
  HealthScoreChanged: 'HealthScoreChanged',
} as const;

export type HealthEventName = (typeof HEALTH_EVENTS)[keyof typeof HEALTH_EVENTS];

const PUBLISHER_AUTHORITY = 'Health Authority';

export const HEALTH_EVENT_DEFINITIONS: EventDefinition[] = Object.values(HEALTH_EVENTS).map((name) => ({
  id: `health.${name}`,
  name,
  category: 'health',
  description: `IHIA event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: name === HEALTH_EVENTS.HealthCritical || name === HEALTH_EVENTS.FailurePredicted ? 'high' : 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));

/** Local synchronous delivery plus optional best-effort Institutional Event Bus publication. */
export class HealthEventBus {
  private emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();

  constructor(private readonly institutionalEventBus?: InstitutionalEventBus) {
    if (institutionalEventBus) {
      for (const definition of HEALTH_EVENT_DEFINITIONS) {
        if (!institutionalEventBus.getEventDefinition(definition.name)) institutionalEventBus.registerEventType(definition);
      }
    }
  }

  publish(event: HealthEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
    if (this.institutionalEventBus) {
      this.lastMirrorPromise = this.institutionalEventBus.publish(event, PUBLISHER_AUTHORITY, payload).catch(() => {
        // Event mirroring must not block institutional assessment or local subscribers.
      });
    }
  }

  subscribe(event: HealthEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }

  async flushMirror(): Promise<void> {
    await this.lastMirrorPromise;
  }
}
