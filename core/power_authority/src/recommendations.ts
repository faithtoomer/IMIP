import type {
  ElectricityPricing,
  PowerBudget,
  PowerProfile,
  PowerRecommendation,
} from './types.js';
import { resolvePricingWindow } from './pricing.js';

let recommendationCounter = 0;

function nextRecommendationId(): string {
  recommendationCounter += 1;
  return `rec-${recommendationCounter}-${Date.now()}`;
}

/**
 * §11 — generate advisory recommendations from profiles, budgets, and pricing.
 * NEVER executes hardware control — advisory: true on every recommendation.
 */
export function generateRecommendations(
  profiles: PowerProfile[],
  budgets: PowerBudget[],
  pricing: ElectricityPricing,
  at: Date = new Date(),
): PowerRecommendation[] {
  const recommendations: PowerRecommendation[] = [];
  const now = at.toISOString();
  const pricingWindow = resolvePricingWindow(pricing, at);

  for (const profile of profiles) {
    if (!profile.sensorAvailable) continue;

    if (profile.currentWatts > profile.maximumRatedWatts * 0.95 && profile.maximumRatedWatts > 0) {
      recommendations.push({
        id: nextRecommendationId(),
        deviceId: profile.deviceId,
        action: 'Consider reducing power limit',
        rationale: `Device "${profile.deviceId}" is drawing ${profile.currentWatts}W, near its ${profile.maximumRatedWatts}W rated maximum.`,
        supportingMeasurements: {
          currentWatts: profile.currentWatts,
          maximumRatedWatts: profile.maximumRatedWatts,
          utilizationPercent: (profile.currentWatts / profile.maximumRatedWatts) * 100,
        },
        generatedAt: now,
        advisory: true,
      });
    }

    if (profile.efficiencyProfile.trend === 'declining') {
      recommendations.push({
        id: nextRecommendationId(),
        deviceId: profile.deviceId,
        action: 'Investigate declining efficiency',
        rationale: `Efficiency trend for "${profile.deviceId}" is declining — review workload configuration or thermal conditions.`,
        supportingMeasurements: {
          efficiency: profile.efficiencyProfile,
          averageWatts: profile.averageWatts,
        },
        generatedAt: now,
        advisory: true,
      });
    }
  }

  for (const budget of budgets) {
    if (budget.exceeded) {
      recommendations.push({
        id: nextRecommendationId(),
        action: `Reduce ${budget.scope} power draw`,
        rationale: `Budget "${budget.id}" exceeded: ${budget.currentWatts}W > ${budget.limitWatts}W limit.`,
        supportingMeasurements: {
          budgetId: budget.id,
          scope: budget.scope,
          currentWatts: budget.currentWatts,
          limitWatts: budget.limitWatts,
        },
        generatedAt: now,
        advisory: true,
      });
    }
  }

  if (pricingWindow === 'peak' && profiles.some((p) => p.currentWatts > p.idleWatts * 2)) {
    recommendations.push({
      id: nextRecommendationId(),
      action: 'Delay non-critical workloads until off-peak',
      rationale: `Electricity is in peak pricing window (${pricing.billingModel}). Deferring discretionary workloads may reduce cost.`,
      supportingMeasurements: {
        pricingWindow,
        peakRate: pricing.peakRate ?? pricing.ratePerKwh,
        offPeakRate: pricing.offPeakRate ?? pricing.ratePerKwh,
        activeDevices: profiles.filter((p) => p.currentWatts > p.idleWatts * 2).map((p) => p.deviceId),
      },
      generatedAt: now,
      advisory: true,
    });
  }

  const ranked = [...profiles]
    .filter((p) => p.sensorAvailable && p.efficiencyProfile.revenuePerKwh !== undefined)
    .sort((a, b) => (b.efficiencyProfile.revenuePerKwh ?? 0) - (a.efficiencyProfile.revenuePerKwh ?? 0));

  if (ranked.length >= 2) {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (
      best.efficiencyProfile.revenuePerKwh !== undefined &&
      worst.efficiencyProfile.revenuePerKwh !== undefined &&
      best.efficiencyProfile.revenuePerKwh > worst.efficiencyProfile.revenuePerKwh * 1.5
    ) {
      recommendations.push({
        id: nextRecommendationId(),
        deviceId: worst.deviceId,
        action: 'Consider shifting workload to more efficient device',
        rationale: `Device "${best.deviceId}" generates ${best.efficiencyProfile.revenuePerKwh.toFixed(4)} revenue/kWh vs "${worst.deviceId}" at ${worst.efficiencyProfile.revenuePerKwh.toFixed(4)} revenue/kWh.`,
        supportingMeasurements: {
          bestDevice: best.deviceId,
          bestRevenuePerKwh: best.efficiencyProfile.revenuePerKwh,
          worstDevice: worst.deviceId,
          worstRevenuePerKwh: worst.efficiencyProfile.revenuePerKwh,
        },
        generatedAt: now,
        advisory: true,
      });
    }
  }

  return recommendations;
}

/** Reset recommendation ID counter — for deterministic tests only. */
export function resetRecommendationCounter(): void {
  recommendationCounter = 0;
}
