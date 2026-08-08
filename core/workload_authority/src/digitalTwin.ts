import type {
  WorkloadBottleneck,
  WorkloadDigitalTwin,
  WorkloadForecast,
  WorkloadHistoryEntry,
  WorkloadProfile,
  WorkloadTelemetrySample,
} from './types.js';
import { computeWorkloadForecast } from './forecast.js';

export interface WorkloadDigitalTwinContext {
  profile: WorkloadProfile;
  history: WorkloadHistoryEntry[];
  telemetry: WorkloadTelemetrySample[];
  now: string;
}

/**
 * §11 — Institutional Workload Digital Twin (IWDT). It is descriptive,
 * predictive, and explainable; it never allocates resources or schedules work.
 */
export function assembleWorkloadDigitalTwin(ctx: WorkloadDigitalTwinContext): WorkloadDigitalTwin {
  const samples = [...ctx.telemetry].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const latest = samples.at(-1);
  const thermalReadings = samples.map((sample) => sample.thermalCelsius).filter((value): value is number => value !== undefined);
  const watts = samples.map((sample) => sample.powerWatts).filter((value): value is number => value !== undefined);
  const throughput = samples.map((sample) => sample.throughput).filter((value): value is number => value !== undefined);
  const forecast = computeWorkloadForecast({
    profile: ctx.profile,
    history: ctx.history,
    telemetry: samples,
    now: ctx.now,
  });
  const currentCelsius = latest?.thermalCelsius;
  const peakCelsius = thermalReadings.length > 0 ? Math.max(...thermalReadings) : undefined;
  const thermalStatus = thermalState(currentCelsius ?? peakCelsius);
  const averageWatts = average(watts);
  const averageThroughput = average(throughput);
  const idlePercent = samples.length === 0 ? 0 : (samples.filter((sample) => sample.idle).length / samples.length) * 100;
  const bottlenecks = analyzeBottlenecks(ctx.profile, forecast, samples, thermalStatus, idlePercent, averageThroughput);

  return {
    workloadId: ctx.profile.workloadId,
    profile: ctx.profile,
    resourceUsage: latest?.resourceUsage ?? {},
    thermalImpact: { currentCelsius, peakCelsius, status: thermalStatus },
    powerConsumption: {
      currentWatts: latest?.powerWatts,
      averageWatts,
      peakWatts: watts.length > 0 ? Math.max(...watts) : undefined,
    },
    runtimeEfficiency: {
      averageThroughput,
      throughputPerWatt: averageWatts && averageThroughput !== undefined ? averageThroughput / averageWatts : undefined,
      idlePercent,
    },
    historicalPerformance: ctx.profile.historicalPerformance,
    forecast,
    bottlenecks,
    updatedAt: ctx.now,
  };
}

function average(values: number[]): number | undefined {
  return values.length === 0 ? undefined : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function thermalState(celsius: number | undefined): 'unknown' | 'normal' | 'elevated' | 'critical' {
  if (celsius === undefined) return 'unknown';
  if (celsius >= 90) return 'critical';
  if (celsius >= 75) return 'elevated';
  return 'normal';
}

function analyzeBottlenecks(
  profile: WorkloadProfile,
  forecast: WorkloadForecast,
  samples: WorkloadTelemetrySample[],
  thermalStatus: 'unknown' | 'normal' | 'elevated' | 'critical',
  idlePercent: number,
  averageThroughput: number | undefined,
): WorkloadBottleneck[] {
  const bottlenecks: WorkloadBottleneck[] = [];

  if (profile.dependencies.length > 0 && profile.state !== 'running' && profile.state !== 'completed') {
    bottlenecks.push({
      kind: 'dependency-wait',
      severity: 'info',
      explanation: `${profile.dependencies.length} dependency reference(s) influence placement readiness.`,
    });
  }
  if (forecast.queueDelayMs !== undefined && forecast.queueDelayMs > 0) {
    bottlenecks.push({
      kind: 'queue-delay',
      severity: forecast.queueDelayMs > profile.estimatedDurationMs * 0.25 ? 'warning' : 'info',
      explanation: `Observed queue delay is ${forecast.queueDelayMs} ms.`,
    });
  }
  const utilization = samples
    .map((sample) => sample.resourceUsage.assignedResourceUtilizationPercent)
    .filter((value): value is number => value !== undefined);
  if (utilization.some((value) => value >= 90)) {
    bottlenecks.push({
      kind: 'resource-contention',
      severity: 'warning',
      explanation: 'Assigned resource utilization reached 90% or higher.',
    });
  }
  if (thermalStatus === 'elevated' || thermalStatus === 'critical') {
    bottlenecks.push({
      kind: 'thermal-pressure',
      severity: thermalStatus === 'critical' ? 'critical' : 'warning',
      explanation: `Thermal impact is ${thermalStatus}.`,
    });
  }
  if (idlePercent >= 50) {
    bottlenecks.push({
      kind: 'idle-runtime',
      severity: 'warning',
      explanation: `${idlePercent.toFixed(1)}% of telemetry samples report idle runtime.`,
    });
  }
  if (samples.length > 0 && (averageThroughput === undefined || averageThroughput <= 0)) {
    bottlenecks.push({
      kind: 'no-throughput',
      severity: 'warning',
      explanation: 'Telemetry exists but reports no positive throughput.',
    });
  }
  return bottlenecks;
}
