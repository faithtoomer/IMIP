import type { EfficiencyMetrics, EfficiencyTrend, WorkloadTelemetry } from './types.js';

/**
 * Compute efficiency metrics from power draw and optional workload telemetry.
 * All metrics are descriptive — never triggers hardware control.
 */
export function computeEfficiency(
  averageWatts: number,
  workload?: WorkloadTelemetry,
  previousTrend?: EfficiencyTrend,
): EfficiencyMetrics {
  const metrics: EfficiencyMetrics = { trend: previousTrend ?? 'unknown' };

  if (averageWatts <= 0) {
    return metrics;
  }

  if (workload?.hashesPerSecond !== undefined && workload.hashesPerSecond > 0) {
    metrics.hashesPerWatt = workload.hashesPerSecond / averageWatts;
  }

  const kwhPerHour = averageWatts / 1000;
  if (kwhPerHour > 0) {
    if (workload?.acceptedShares !== undefined && workload.acceptedShares > 0) {
      metrics.sharesPerKwh = workload.acceptedShares / kwhPerHour;
    }
    if (workload?.revenuePerHour !== undefined && workload.revenuePerHour > 0) {
      metrics.revenuePerKwh = workload.revenuePerHour / kwhPerHour;
      if (workload.acceptedShares !== undefined && workload.acceptedShares > 0) {
        const costPerHour = kwhPerHour * (workload.revenuePerHour / kwhPerHour > 0 ? workload.revenuePerHour / kwhPerHour : 0);
        if (costPerHour > 0) {
          metrics.costPerAcceptedShare = costPerHour / workload.acceptedShares;
        }
      }
    }
  }

  if (previousTrend && metrics.hashesPerWatt !== undefined) {
    metrics.trend = previousTrend;
  }

  return metrics;
}

/**
 * Determine efficiency trend by comparing current hashes/watt against a
 * previous value. Returns 'unknown' when insufficient data exists.
 */
export function computeEfficiencyTrend(
  currentHashesPerWatt: number | undefined,
  previousHashesPerWatt: number | undefined,
): EfficiencyTrend {
  if (currentHashesPerWatt === undefined || previousHashesPerWatt === undefined) {
    return 'unknown';
  }
  if (previousHashesPerWatt === 0) return 'unknown';
  const delta = (currentHashesPerWatt - previousHashesPerWatt) / previousHashesPerWatt;
  if (delta > 0.05) return 'improving';
  if (delta < -0.05) return 'declining';
  return 'stable';
}
