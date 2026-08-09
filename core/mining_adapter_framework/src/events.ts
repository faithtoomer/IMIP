import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';

export const ADAPTER_EVENTS = {
  AdapterDiscovered: 'AdapterDiscovered', AdapterRegistered: 'AdapterRegistered', AdapterValidated: 'AdapterValidated', AdapterRejected: 'AdapterRejected', AdapterConfigured: 'AdapterConfigured', MinerPrepared: 'MinerPrepared', MinerStarted: 'MinerStarted', MinerStopped: 'MinerStopped', MinerFailed: 'MinerFailed', MinerRecovered: 'MinerRecovered', MinerStatisticsUpdated: 'MinerStatisticsUpdated',
} as const;
export type AdapterEventName = (typeof ADAPTER_EVENTS)[keyof typeof ADAPTER_EVENTS];
const PUBLISHER = 'Mining Adapter Framework';
export const ADAPTER_EVENT_DEFINITIONS: EventDefinition[] = Object.values(ADAPTER_EVENTS).map((name) => ({ id: `mining-adapter.${name}`, name, category: 'mining-adapter', description: `IMAF event: ${name}`, publisherAuthority: PUBLISHER, priority: name === ADAPTER_EVENTS.MinerFailed || name === ADAPTER_EVENTS.AdapterRejected ? 'high' : 'normal', deliveryMode: 'async', targeting: 'broadcast', version: '1.0.0' }));
export class AdapterEventBus {
  private readonly emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();
  constructor(private readonly institutionalEventBus?: InstitutionalEventBus) {
    if (institutionalEventBus) for (const definition of ADAPTER_EVENT_DEFINITIONS) if (!institutionalEventBus.getEventDefinition(definition.name)) institutionalEventBus.registerEventType(definition);
  }
  publish(event: AdapterEventName, payload: unknown): void { this.emitter.emit(event, payload); if (this.institutionalEventBus) this.lastMirrorPromise = this.institutionalEventBus.publish(event, PUBLISHER, payload).catch(() => undefined); }
  subscribe(event: AdapterEventName, handler: (payload: unknown) => void): () => void { this.emitter.on(event, handler); return () => this.emitter.off(event, handler); }
  async flushMirror(): Promise<void> { await this.lastMirrorPromise; }
}
