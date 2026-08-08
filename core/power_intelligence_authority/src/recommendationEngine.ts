import { randomUUID } from 'node:crypto';
import type { RuntimeState } from '../../hardware_authority/src/index.js';
import type { EfficiencyMetrics, PowerBudgetStatus, PowerProfile, PowerRecommendation } from './types.js';

/** A device drawing more than this multiple of its established idle
 * baseline while runtime-idle is a real, explainable signal that its idle
 * timeout may be too long — not a guess, a documented threshold. */
const IDLE_DRAW_THRESHOLD_MULTIPLIER = 1.5;

/** Efficiency spread across same-category devices beyond this fraction is a
 * real, explainable signal worth surfacing — not a fabricated ranking. */
const EFFICIENCY_SWITCH_THRESHOLD = 0.2;

export interface RecommendationInput {
  profiles: PowerProfile[];
  efficiencies: Map<string, EfficiencyMetrics>;
  budgetStatuses: PowerBudgetStatus[];
  runtimeStates: Map<string, RuntimeState>;
  isOffPeakNow: boolean;
  now: Date;
}

/** §12 — Recommendation Engine. Every recommendation is advisory only (Law
 * 6) and grounded in real measured/derived data already collected elsewhere
 * in this module — never a fabricated or ML-guessed suggestion. */
export function generateRecommendations(input: RecommendationInput): PowerRecommendation[] {
  const { profiles, efficiencies, budgetStatuses, runtimeStates, isOffPeakNow, now } = input;
  const recommendations: PowerRecommendation[] = [];
  const generatedAt = now.toISOString();

  for (const status of budgetStatuses) {
    if (status.exceeded && status.targetDeviceId) {
      recommendations.push({
        recommendationId: randomUUID(),
        type: 'reduce-power-limit',
        deviceId: status.targetDeviceId,
        message: `Device "${status.targetDeviceId}" is drawing ${status.currentWatts}W against a budget of ${status.limitWatts}W. Reduce the GPU power limit.`,
        supportingMeasurements: { budgetId: status.budgetId, currentWatts: status.currentWatts, limitWatts: status.limitWatts },
        generatedAt,
      });
    }
  }

  for (const profile of profiles) {
    const runtimeState = runtimeStates.get(profile.deviceId);
    if (
      runtimeState === 'available' &&
      profile.currentPowerWatts !== undefined &&
      profile.idlePowerWatts !== undefined &&
      profile.idlePowerWatts > 0 &&
      profile.currentPowerWatts > profile.idlePowerWatts * IDLE_DRAW_THRESHOLD_MULTIPLIER
    ) {
      recommendations.push({
        recommendationId: randomUUID(),
        type: 'increase-idle-timeout',
        deviceId: profile.deviceId,
        message: `Device "${profile.deviceId}" is idle but drawing ${profile.currentPowerWatts}W, above ${IDLE_DRAW_THRESHOLD_MULTIPLIER}x its established idle baseline of ${profile.idlePowerWatts}W. Increase the idle timeout.`,
        supportingMeasurements: { currentPowerWatts: profile.currentPowerWatts, idlePowerWatts: profile.idlePowerWatts, threshold: IDLE_DRAW_THRESHOLD_MULTIPLIER },
        generatedAt,
      });
    }
  }

  if (!isOffPeakNow) {
    for (const [deviceId, runtimeState] of runtimeStates) {
      if (runtimeState === 'benchmarking') {
        recommendations.push({
          recommendationId: randomUUID(),
          type: 'delay-until-off-peak',
          deviceId,
          message: `Device "${deviceId}" is benchmarking during a peak electricity pricing window. Delay non-critical benchmarks until off-peak hours.`,
          supportingMeasurements: { runtimeState, isOffPeakNow },
          generatedAt,
        });
      }
    }
  }

  const byCategory = new Map<string, { deviceId: string; hashesPerWatt: number }[]>();
  for (const profile of profiles) {
    const efficiency = efficiencies.get(profile.deviceId);
    if (efficiency?.hashesPerWatt === undefined) continue;
    const bucket = byCategory.get(profile.deviceCategory) ?? [];
    bucket.push({ deviceId: profile.deviceId, hashesPerWatt: efficiency.hashesPerWatt });
    byCategory.set(profile.deviceCategory, bucket);
  }

  for (const [category, entries] of byCategory) {
    if (entries.length < 2) continue;
    const sorted = [...entries].sort((a, b) => b.hashesPerWatt - a.hashesPerWatt);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (worst.hashesPerWatt <= 0) continue;
    const spread = (best.hashesPerWatt - worst.hashesPerWatt) / worst.hashesPerWatt;
    if (spread > EFFICIENCY_SWITCH_THRESHOLD) {
      recommendations.push({
        recommendationId: randomUUID(),
        type: 'switch-to-efficient-device',
        deviceId: worst.deviceId,
        message: `Device "${worst.deviceId}" (${worst.hashesPerWatt.toFixed(4)} h/W) is ${(spread * 100).toFixed(0)}% less efficient than "${best.deviceId}" (${best.hashesPerWatt.toFixed(4)} h/W) in the same "${category}" category. Consider shifting workload to the more efficient device.`,
        supportingMeasurements: { category, bestDeviceId: best.deviceId, bestHashesPerWatt: best.hashesPerWatt, worstHashesPerWatt: worst.hashesPerWatt, spread },
        generatedAt,
      });
    }
  }

  return recommendations;
}
