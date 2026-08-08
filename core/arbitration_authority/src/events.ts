import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';
export const ARBITRATION_EVENTS = { ResourceContentionDetected: 'ResourceContentionDetected', ArbitrationStarted: 'ArbitrationStarted', ArbitrationCompleted: 'ArbitrationCompleted', ArbitrationFailed: 'ArbitrationFailed', ResourceGranted: 'ResourceGranted', ResourceDeferred: 'ResourceDeferred', ResourceDenied: 'ResourceDenied', StarvationDetected: 'StarvationDetected' } as const;
export type ArbitrationEventName = (typeof ARBITRATION_EVENTS)[keyof typeof ARBITRATION_EVENTS];
const PUBLISHER_AUTHORITY = 'Resource Arbitration Authority';
export const ARBITRATION_EVENT_DEFINITIONS: EventDefinition[] = Object.values(ARBITRATION_EVENTS).map((name) => ({ id: `arbitration.${name}`, name, category: 'arbitration', description: `IRAA event: ${name}`, publisherAuthority: PUBLISHER_AUTHORITY, priority: name === ARBITRATION_EVENTS.ArbitrationFailed || name === ARBITRATION_EVENTS.StarvationDetected ? 'high' : 'normal', deliveryMode: 'async', targeting: 'broadcast', version: '1.0.0' }));
export class ArbitrationEventBus {
  private emitter = new EventEmitter(); private lastMirrorPromise: Promise<unknown> = Promise.resolve();
  constructor(private readonly institutionalEventBus?: InstitutionalEventBus) { if (institutionalEventBus) for (const definition of ARBITRATION_EVENT_DEFINITIONS) if (!institutionalEventBus.getEventDefinition(definition.name)) institutionalEventBus.registerEventType(definition); }
  publish(event: ArbitrationEventName, payload: unknown): void { this.emitter.emit(event, payload); if (this.institutionalEventBus) this.lastMirrorPromise = this.institutionalEventBus.publish(event, PUBLISHER_AUTHORITY, payload).catch(() => undefined); }
  subscribe(event: ArbitrationEventName, handler: (payload: unknown) => void): () => void { this.emitter.on(event, handler); return () => this.emitter.off(event, handler); }
  async flushMirror(): Promise<void> { await this.lastMirrorPromise; }
}
