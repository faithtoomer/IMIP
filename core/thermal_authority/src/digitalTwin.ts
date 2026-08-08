import type {
  PowerSnapshotForThermal,
  ThermalAnomaly,
  ThermalAssessment,
  ThermalBudget,
  ThermalDigitalTwin,
  ThermalForecast,
  ThermalProfile,
  ThermalRecommendation,
  ThermalTrend,
} from './types.js';
import type { PowerSnapshotProvider } from './powerBridge.js';
import { computeHistorySummary } from './history.js';
import type { ThermalHistoryPoint } from './types.js';

export interface DigitalTwinInput {
  profile: ThermalProfile;
  trend: ThermalTrend | null;
  forecast: ThermalForecast | null;
  budget: ThermalBudget | null;
  anomalies: ThermalAnomaly[];
  recommendations: ThermalRecommendation[];
  history: ThermalHistoryPoint[];
  powerProvider: PowerSnapshotProvider;
}

function buildAssessment(
  profile: ThermalProfile,
  trend: ThermalTrend | null,
  budget: ThermalBudget | null,
  forecast: ThermalForecast | null,
  recommendations: ThermalRecommendation[],
  anomalies: ThermalAnomaly[],
): ThermalAssessment {
  const evidence: string[] = [
    `Device ${profile.deviceId} (${profile.deviceType}) at ${profile.currentCelsius}°C, state: ${profile.thermalState}.`,
    `Sensor available: ${profile.sensorAvailable}.`,
  ];

  if (trend) {
    evidence.push(
      `Trend over ${trend.window}: slope ${trend.slopeCelsiusPerMinute.toFixed(3)}°C/min, heating ${trend.heatAccumulationRate.toFixed(3)}°C/min, cooling ${trend.coolingRate.toFixed(3)}°C/min.`,
    );
  }
  if (budget) {
    evidence.push(
      `Budget: operating ${budget.operatingTargetCelsius}°C, warning ${budget.warningThresholdCelsius}°C, critical ${budget.criticalThresholdCelsius}°C.`,
    );
  }
  if (forecast?.minutesToWarning !== undefined) {
    evidence.push(`Forecast: warning threshold in ~${Math.round(forecast.minutesToWarning)} minutes.`);
  }
  if (anomalies.length > 0) {
    evidence.push(`${anomalies.length} anomaly(ies) detected: ${anomalies.map((a) => a.kind).join(', ')}.`);
  }
  if (recommendations.length > 0) {
    evidence.push(`${recommendations.length} advisory recommendation(s) generated.`);
  }

  return {
    deviceId: profile.deviceId,
    profile,
    sensors: {
      available: profile.sensorAvailable,
      coreCelsius: profile.coreCelsius,
      memoryCelsius: profile.memoryCelsius,
      hotspotCelsius: profile.hotspotCelsius,
      vrmCelsius: profile.vrmCelsius,
      fanRpm: profile.fanRpm,
      ambientCelsius: profile.ambientCelsius,
    },
    trend,
    budget,
    forecast,
    recommendations,
    anomalies,
    evidence,
  };
}

export function assembleDigitalTwin(input: DigitalTwinInput): ThermalDigitalTwin {
  const { profile, trend, forecast, budget, anomalies, recommendations, history, powerProvider } = input;
  const watts = powerProvider.getPowerWatts(profile.deviceId);
  const powerSnapshot: PowerSnapshotForThermal | null =
    watts !== undefined
      ? { deviceId: profile.deviceId, watts, capturedAt: new Date().toISOString() }
      : null;

  const assessment = buildAssessment(profile, trend, budget, forecast, recommendations, anomalies);

  return {
    deviceId: profile.deviceId,
    profile,
    trend,
    forecast,
    budget,
    anomalies,
    recommendations,
    powerSnapshot,
    historySummary: computeHistorySummary(history),
    assessment,
  };
}

export function devicesNearingWarning(profiles: ThermalProfile[], budgets: Map<string, ThermalBudget>): ThermalProfile[] {
  return profiles.filter((profile) => {
    const budget = budgets.get(profile.deviceId);
    if (!budget) return false;
    const margin = budget.warningThresholdCelsius - profile.currentCelsius;
    return margin > 0 && margin <= 5;
  });
}

export function estimateThermalImpactOfPowerReduction(
  currentCelsius: number,
  currentWatts: number,
  targetWatts: number,
  efficiencyFactor = 0.5,
): number {
  if (currentWatts <= 0 || targetWatts >= currentWatts) return currentCelsius;
  const reductionRatio = (currentWatts - targetWatts) / currentWatts;
  return currentCelsius - currentCelsius * reductionRatio * efficiencyFactor;
}

export function degradationCandidates(
  profiles: ThermalProfile[],
  anomalies: ThermalAnomaly[],
): { deviceId: string; reasons: string[] }[] {
  const byDevice = new Map<string, string[]>();

  for (const profile of profiles) {
    if (profile.thermalState === 'warning' || profile.thermalState === 'critical') {
      const reasons = byDevice.get(profile.deviceId) ?? [];
      reasons.push(`Thermal state: ${profile.thermalState}`);
      byDevice.set(profile.deviceId, reasons);
    }
  }

  for (const anomaly of anomalies) {
    if (anomaly.kind === 'cooling-degradation' || anomaly.kind === 'fan-anomaly') {
      const reasons = byDevice.get(anomaly.deviceId) ?? [];
      reasons.push(`Anomaly: ${anomaly.kind}`);
      byDevice.set(anomaly.deviceId, reasons);
    }
  }

  return [...byDevice.entries()].map(([deviceId, reasons]) => ({ deviceId, reasons }));
}

export interface PlatformThermalSummary {
  deviceCount: number;
  averageCelsius: number;
  peakCelsius: number;
  warningCount: number;
  criticalCount: number;
  sensorsUnavailable: number;
}

export function platformThermalSummary(profiles: ThermalProfile[]): PlatformThermalSummary {
  if (profiles.length === 0) {
    return {
      deviceCount: 0,
      averageCelsius: 0,
      peakCelsius: 0,
      warningCount: 0,
      criticalCount: 0,
      sensorsUnavailable: 0,
    };
  }

  const temps = profiles.map((p) => p.currentCelsius);
  return {
    deviceCount: profiles.length,
    averageCelsius: temps.reduce((a, b) => a + b, 0) / temps.length,
    peakCelsius: Math.max(...temps),
    warningCount: profiles.filter((p) => p.thermalState === 'warning').length,
    criticalCount: profiles.filter((p) => p.thermalState === 'critical').length,
    sensorsUnavailable: profiles.filter((p) => !p.sensorAvailable).length,
  };
}
