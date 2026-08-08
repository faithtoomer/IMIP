import { EventEmitter } from 'node:events';

/** §14 — minimum published event set. */
export const POWER_EVENTS = {
  ProfileCreated: 'PowerProfileCreated',
  UsageUpdated: 'PowerUsageUpdated',
  BudgetExceeded: 'PowerBudgetExceeded',
  BudgetRecovered: 'PowerBudgetRecovered',
  EfficiencyCalculated: 'EfficiencyCalculated',
  CostUpdated: 'CostUpdated',
  RecommendationGenerated: 'RecommendationGenerated',
  SensorUnavailable: 'PowerSensorUnavailable',
  HealthChanged: 'PowerHealthChanged',
} as const;

export type PowerEventName = (typeof POWER_EVENTS)[keyof typeof POWER_EVENTS];

/**
 * Interim publish/subscribe surface for IPIA — same pattern as IHIS's
 * HardwareEventBus, standing in for the institutional Event Bus until it
 * is implemented.
 */
export class PowerEventBus {
  private emitter = new EventEmitter();

  publish(event: PowerEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
  }

  subscribe(event: PowerEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }
}
