import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';
import { NOTIFICATION_EVENTS } from './types.js';
import type { NotificationEventName } from './types.js';

const PUBLISHER_AUTHORITY = 'Notification & Communication Authority';

/** §15 — registered under the Event Bus's existing `'notification'`
 * category, reserved and unused since Phase 01/05 — no widening needed. */
const NOTIFICATION_EVENT_DEFINITIONS: EventDefinition[] = Object.values(NOTIFICATION_EVENTS).map((name) => ({
  id: `notification.${name}`,
  name,
  category: 'notification',
  description: `INCA event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: name === NOTIFICATION_EVENTS.NotificationFailed || name === NOTIFICATION_EVENTS.NotificationEscalated ? 'high' : 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));

/**
 * Publish/subscribe surface for INCA, bridged onto the Institutional Event
 * Bus (ADR-0009 §6 mirror pattern), the same choice made for ISTA
 * (ADR-0015): `requestNotification()` is synchronous (Law 6 "non-blocking"
 * — see ADR-0016), so events mirror fire-and-forget rather than being
 * awaited inline.
 */
export class NotificationEventBus {
  private emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();

  constructor(private readonly iebBus?: InstitutionalEventBus) {
    if (this.iebBus) {
      for (const definition of NOTIFICATION_EVENT_DEFINITIONS) {
        if (!this.iebBus.getEventDefinition(definition.name)) {
          this.iebBus.registerEventType(definition);
        }
      }
    }
  }

  publish(event: NotificationEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
    if (this.iebBus) {
      this.lastMirrorPromise = this.iebBus.publish(event, PUBLISHER_AUTHORITY, payload).catch(() => {
        // Mirroring is observability, not a functional dependency.
      });
    }
  }

  subscribe(event: NotificationEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }

  async flushMirror(): Promise<void> {
    await this.lastMirrorPromise;
  }
}
