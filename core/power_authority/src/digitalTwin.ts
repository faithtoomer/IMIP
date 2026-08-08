import type {
  ElectricityPricing,
  EnergyDigitalTwin,
  EfficiencyTrend,
  PowerBudget,
  PowerProfile,
  PowerRecommendation,
} from './types.js';
import { computeEfficiencyTrend } from './efficiency.js';
import type { PowerHistoryStore } from './history.js';

export interface PlatformEnergySummary {
  totalCurrentWatts: number;
  totalAverageWatts: number;
  totalPeakWatts: number;
  deviceCount: number;
  sensorsAvailable: number;
  sensorsUnavailable: number;
  estimatedCostPerHour: number;
  estimatedCostPerDay: number;
  currency: string;
}

/**
 * §23 — Institutional Energy Digital Twin (IEDT). Descriptive, predictive,
 * and explainable — never directly controlling hardware.
 */
export function assembleEnergyDigitalTwin(
  profile: PowerProfile,
  pricing: ElectricityPricing,
  budgets: PowerBudget[],
  recommendations: PowerRecommendation[],
  historyTrend: EfficiencyTrend,
): EnergyDigitalTwin {
  return {
    deviceId: profile.deviceId,
    profile,
    historyTrend,
    pricing,
    efficiency: profile.efficiencyProfile,
    cost: profile.costProfile,
    budgets: budgets.filter((b) => b.scope === profile.deviceType || b.scope === 'platform'),
    recommendations: recommendations.filter((r) => !r.deviceId || r.deviceId === profile.deviceId),
  };
}

export function rankByRevenuePerKwh(profiles: PowerProfile[]): PowerProfile[] {
  return [...profiles]
    .filter((p) => p.efficiencyProfile.revenuePerKwh !== undefined)
    .sort((a, b) => (b.efficiencyProfile.revenuePerKwh ?? 0) - (a.efficiencyProfile.revenuePerKwh ?? 0));
}

export function estimateCostImpactOfPowerReduction(
  profile: PowerProfile,
  reductionWatts: number,
  pricing: ElectricityPricing,
): { savedCostPerHour: number; savedCostPerDay: number; newAverageWatts: number } {
  const newAverageWatts = Math.max(0, profile.averageWatts - reductionWatts);
  const savedWatts = profile.averageWatts - newAverageWatts;
  const savedKwhPerHour = savedWatts / 1000;
  const rate = profile.costProfile.ratePerKwh;
  const savedCostPerHour = savedKwhPerHour * rate;
  return {
    savedCostPerHour,
    savedCostPerDay: savedCostPerHour * 24,
    newAverageWatts,
  };
}

export function platformEnergySummary(profiles: PowerProfile[]): PlatformEnergySummary {
  const deviceCount = profiles.length;
  const sensorsAvailable = profiles.filter((p) => p.sensorAvailable).length;
  const sensorsUnavailable = deviceCount - sensorsAvailable;

  const totalCurrentWatts = profiles.reduce((sum, p) => sum + p.currentWatts, 0);
  const totalAverageWatts = profiles.reduce((sum, p) => sum + p.averageWatts, 0);
  const totalPeakWatts = profiles.reduce((sum, p) => sum + p.peakWatts, 0);
  const estimatedCostPerHour = profiles.reduce((sum, p) => sum + p.costProfile.costPerHour, 0);
  const estimatedCostPerDay = profiles.reduce((sum, p) => sum + p.costProfile.costPerDay, 0);
  const currency = profiles[0]?.costProfile.currency ?? 'USD';

  return {
    totalCurrentWatts,
    totalAverageWatts,
    totalPeakWatts,
    deviceCount,
    sensorsAvailable,
    sensorsUnavailable,
    estimatedCostPerHour,
    estimatedCostPerDay,
    currency,
  };
}

export function efficiencyTrendFromHistory(
  history: PowerHistoryStore,
  deviceId: string,
  workloadHashesPerSecond?: number,
): EfficiencyTrend {
  const points = history.forDevice(deviceId);
  if (points.length < 2) return 'unknown';

  const recent = points.slice(-5);
  const watts = recent.map((p) => p.watts);
  const avgRecent = watts.reduce((a, b) => a + b, 0) / watts.length;
  const avgEarlier = points.slice(0, Math.max(1, points.length - 5)).reduce((a, p) => a + p.watts, 0) / Math.max(1, points.length - 5);

  if (workloadHashesPerSecond !== undefined && avgRecent > 0 && avgEarlier > 0) {
    const currentHpW = workloadHashesPerSecond / avgRecent;
    const previousHpW = workloadHashesPerSecond / avgEarlier;
    return computeEfficiencyTrend(currentHpW, previousHpW);
  }

  if (avgEarlier === 0) return 'unknown';
  const delta = (avgRecent - avgEarlier) / avgEarlier;
  if (delta < -0.05) return 'improving';
  if (delta > 0.05) return 'declining';
  return 'stable';
}
