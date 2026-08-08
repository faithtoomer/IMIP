import type {
  ThermalAnomaly,
  ThermalBudget,
  ThermalForecast,
  ThermalProfile,
  ThermalRecommendation,
  ThermalTrend,
} from './types.js';

let recommendationCounter = 0;

function nextRecommendationId(): string {
  recommendationCounter += 1;
  return `recommendation-${recommendationCounter}-${Date.now()}`;
}

export function resetRecommendationCounter(): void {
  recommendationCounter = 0;
}

export interface RecommendationInput {
  profile: ThermalProfile;
  budget: ThermalBudget;
  forecast: ThermalForecast | null;
  trend: ThermalTrend | null;
  anomalies: ThermalAnomaly[];
  generatedAt: string;
}

/**
 * Generate advisory thermal recommendations only.
 * ITIA never controls fans, clocks, or voltages.
 */
export function generateRecommendations(input: RecommendationInput): ThermalRecommendation[] {
  const { profile, budget, forecast, trend, anomalies, generatedAt } = input;
  const recommendations: ThermalRecommendation[] = [];

  if (!profile.sensorAvailable) {
    recommendations.push({
      id: nextRecommendationId(),
      deviceId: profile.deviceId,
      action: 'Investigate sensor connectivity and replace or recalibrate the thermal sensor.',
      rationale: 'Thermal sensor is unavailable; operating without temperature visibility is unsafe.',
      supportingEvidence: { sensorAvailable: false },
      generatedAt,
      advisory: true,
    });
    return recommendations;
  }

  if (profile.thermalState === 'critical') {
    recommendations.push({
      id: nextRecommendationId(),
      deviceId: profile.deviceId,
      action: 'Reduce workload immediately and verify cooling system operation.',
      rationale: `Device temperature (${profile.currentCelsius}°C) exceeds critical threshold (${budget.criticalThresholdCelsius}°C).`,
      supportingEvidence: { currentCelsius: profile.currentCelsius, criticalThreshold: budget.criticalThresholdCelsius },
      generatedAt,
      advisory: true,
    });
  } else if (profile.thermalState === 'warning') {
    recommendations.push({
      id: nextRecommendationId(),
      deviceId: profile.deviceId,
      action: 'Consider reducing workload or improving airflow to prevent further temperature rise.',
      rationale: `Device temperature (${profile.currentCelsius}°C) exceeds warning threshold (${budget.warningThresholdCelsius}°C).`,
      supportingEvidence: { currentCelsius: profile.currentCelsius, warningThreshold: budget.warningThresholdCelsius },
      generatedAt,
      advisory: true,
    });
  }

  if (forecast?.coolingRequirementNote) {
    recommendations.push({
      id: nextRecommendationId(),
      deviceId: profile.deviceId,
      action: 'Review cooling capacity and ambient conditions.',
      rationale: forecast.coolingRequirementNote,
      supportingEvidence: {
        expectedCelsius: forecast.expectedCelsius,
        minutesToWarning: forecast.minutesToWarning,
        minutesToCritical: forecast.minutesToCritical,
      },
      generatedAt,
      advisory: true,
    });
  }

  if (trend && trend.slopeCelsiusPerMinute > 0.5) {
    recommendations.push({
      id: nextRecommendationId(),
      deviceId: profile.deviceId,
      action: 'Monitor rising temperature trend; prepare workload throttling if trend continues.',
      rationale: `Temperature rising at ${trend.slopeCelsiusPerMinute.toFixed(2)}°C/min over the ${trend.window} window.`,
      supportingEvidence: { slopeCelsiusPerMinute: trend.slopeCelsiusPerMinute },
      generatedAt,
      advisory: true,
    });
  }

  for (const anomaly of anomalies) {
    if (anomaly.kind === 'fan-anomaly') {
      recommendations.push({
        id: nextRecommendationId(),
        deviceId: profile.deviceId,
        action: 'Inspect fan operation and clean dust from heatsinks.',
        rationale: 'Fan speed is abnormally low relative to device temperature.',
        supportingEvidence: anomaly.evidence,
        generatedAt,
        advisory: true,
      });
    }
    if (anomaly.kind === 'cooling-degradation') {
      recommendations.push({
        id: nextRecommendationId(),
        deviceId: profile.deviceId,
        action: 'Schedule maintenance to inspect thermal paste, heatsink seating, and airflow paths.',
        rationale: 'Cooling efficiency appears degraded relative to heat generation.',
        supportingEvidence: anomaly.evidence,
        generatedAt,
        advisory: true,
      });
    }
  }

  if (profile.currentCelsius > budget.operatingTargetCelsius && profile.thermalState === 'nominal') {
    recommendations.push({
      id: nextRecommendationId(),
      deviceId: profile.deviceId,
      action: 'Temperature is above operating target but within safe limits; monitor for sustained elevation.',
      rationale: `Current ${profile.currentCelsius}°C exceeds operating target ${budget.operatingTargetCelsius}°C.`,
      supportingEvidence: { operatingTarget: budget.operatingTargetCelsius },
      generatedAt,
      advisory: true,
    });
  }

  return recommendations;
}
