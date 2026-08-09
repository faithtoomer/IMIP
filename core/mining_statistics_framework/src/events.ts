import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';
import type { AnomalyRecord, DataQualityRejectionReason, StatisticsMetric } from './types.js';

export const MINING_STATISTICS_EVENTS = {
  StatisticsCollected: 'StatisticsCollected',
  StatisticsValidated: 'StatisticsValidated',
  StatisticsRejected: 'StatisticsRejected',
  HashrateUpdated: 'HashrateUpdated',
  ShareStatisticsUpdated: 'ShareStatisticsUpdated',
  EfficiencyUpdated: 'EfficiencyUpdated',
  StatisticsAnomalyDetected: 'StatisticsAnomalyDetected',
} as const;

export type MiningStatisticsEventName = (typeof MINING_STATISTICS_EVENTS)[keyof typeof MINING_STATISTICS_EVENTS];
export type MiningStatisticsEventPayload = { metric: StatisticsMetric; rejectionReason?: DataQualityRejectionReason; anomaly?: AnomalyRecord };

const PUBLISHER = 'Mining Statistics Framework';
export const MINING_STATISTICS_EVENT_DEFINITIONS: EventDefinition[] = Object.values(MINING_STATISTICS_EVENTS).map((name) => ({
  id: `mining-statistics.${name}`,
  name,
  category: 'mining-statistics',
  description: `IMSF event: ${name}`,
  publisherAuthority: PUBLISHER,
  priority: name === MINING_STATISTICS_EVENTS.StatisticsRejected || name === MINING_STATISTICS_EVENTS.StatisticsAnomalyDetected ? 'high' : 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));

export class MiningStatisticsEventBus {
  private readonly emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();

  constructor(private readonly institutional?: InstitutionalEventBus) {
    if (institutional) for (const definition of MINING_STATISTICS_EVENT_DEFINITIONS) if (!institutional.getEventDefinition(definition.name)) institutional.registerEventType(definition);
  }

  publish(event: MiningStatisticsEventName, payload: MiningStatisticsEventPayload): void {
    this.emitter.emit(event, payload);
    if (this.institutional) this.lastMirrorPromise = this.institutional.publish(event, PUBLISHER, payload).catch(() => undefined);
  }

  subscribe(event: MiningStatisticsEventName, handler: (payload: MiningStatisticsEventPayload) => void): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }

  async flushMirror(): Promise<void> { await this.lastMirrorPromise; }
}
