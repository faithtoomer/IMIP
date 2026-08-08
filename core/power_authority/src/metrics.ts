/**
 * §18 — interim metrics collector for telemetry latency, registry updates,
 * recommendation generation time, historical query performance, sensor
 * availability, and calculation latency.
 */
export class MetricsCollector {
  private telemetryLatencyMs: number[] = [];
  private registryUpdateCount = 0;
  private recommendationGenerationMs: number[] = [];
  private historicalQueryMs: number[] = [];
  private sensorAvailableCount = 0;
  private sensorTotalCount = 0;
  private calculationLatencyMs: number[] = [];

  recordTelemetryLatency(ms: number): void {
    this.telemetryLatencyMs.push(ms);
  }

  recordRegistryUpdate(): void {
    this.registryUpdateCount += 1;
  }

  recordRecommendationGeneration(ms: number): void {
    this.recommendationGenerationMs.push(ms);
  }

  recordHistoricalQuery(ms: number): void {
    this.historicalQueryMs.push(ms);
  }

  recordSensorOutcome(available: boolean): void {
    this.sensorTotalCount += 1;
    if (available) this.sensorAvailableCount += 1;
  }

  recordCalculationLatency(ms: number): void {
    this.calculationLatencyMs.push(ms);
  }

  snapshot() {
    return {
      telemetryLatencyMs: [...this.telemetryLatencyMs],
      registryUpdateCount: this.registryUpdateCount,
      recommendationGenerationMs: [...this.recommendationGenerationMs],
      historicalQueryMs: [...this.historicalQueryMs],
      sensorAvailabilityRate: this.sensorTotalCount === 0 ? 1 : this.sensorAvailableCount / this.sensorTotalCount,
      calculationLatencyMs: [...this.calculationLatencyMs],
    };
  }

  reset(): void {
    this.telemetryLatencyMs = [];
    this.registryUpdateCount = 0;
    this.recommendationGenerationMs = [];
    this.historicalQueryMs = [];
    this.sensorAvailableCount = 0;
    this.sensorTotalCount = 0;
    this.calculationLatencyMs = [];
  }
}
