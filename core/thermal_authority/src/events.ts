import { EventEmitter } from 'node:events';

/** §15 — minimum published event set. */
export const THERMAL_EVENTS = {
  ThermalProfileCreated: 'ThermalProfileCreated',
  TemperatureUpdated: 'TemperatureUpdated',
  ThermalWarning: 'ThermalWarning',
  ThermalCritical: 'ThermalCritical',
  ThermalRecovered: 'ThermalRecovered',
  ThermalBudgetExceeded: 'ThermalBudgetExceeded',
  ThermalForecastGenerated: 'ThermalForecastGenerated',
  ThermalRecommendationGenerated: 'ThermalRecommendationGenerated',
  ThermalSensorUnavailable: 'ThermalSensorUnavailable',
  ThermalAnomalyDetected: 'ThermalAnomalyDetected',
} as const;

export type ThermalEventName = (typeof THERMAL_EVENTS)[keyof typeof THERMAL_EVENTS];

/**
 * Interim publish/subscribe surface for ITIA — same pattern as IHIS's
 * HardwareEventBus, standing in for the institutional Event Bus until it is implemented.
 */
export class ThermalEventBus {
  private emitter = new EventEmitter();

  publish(event: ThermalEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
  }

  subscribe(event: ThermalEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }
}
