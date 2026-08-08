import type { ThermalBudget, ThermalForecast, ThermalTrend } from './types.js';

export interface ForecastInput {
  currentCelsius: number;
  trend: ThermalTrend;
  budget: ThermalBudget;
  generatedAt: string;
}

function minutesToReach(current: number, target: number, slopePerMinute: number): number | undefined {
  if (slopePerMinute <= 0) return undefined;
  const delta = target - current;
  if (delta <= 0) return undefined;
  return delta / slopePerMinute;
}

/**
 * Forecast expected temperature and ETA to warning/critical from slope + budgets.
 * Advisory only — never triggers hardware control.
 */
export function generateForecast(input: ForecastInput): ThermalForecast {
  const { currentCelsius, trend, budget, generatedAt } = input;
  const slope = trend.slopeCelsiusPerMinute;

  const expectedCelsius = currentCelsius + slope * 15;
  const minutesToWarning = minutesToReach(currentCelsius, budget.warningThresholdCelsius, slope);
  const minutesToCritical = minutesToReach(currentCelsius, budget.criticalThresholdCelsius, slope);

  let coolingRequirementNote: string | undefined;
  if (currentCelsius >= budget.warningThresholdCelsius) {
    coolingRequirementNote = 'Device is at or above warning threshold; enhanced cooling or workload reduction is advised.';
  } else if (minutesToWarning !== undefined && minutesToWarning < 30) {
    coolingRequirementNote = `Warning threshold may be reached in ~${Math.round(minutesToWarning)} minutes at current heating rate.`;
  } else if (slope > 0 && trend.coolingRate < trend.heatAccumulationRate * 0.5) {
    coolingRequirementNote = 'Cooling rate is insufficient relative to heat accumulation; monitor closely.';
  }

  const longTermDriftCelsius = slope * 60 * 24;

  return {
    expectedCelsius,
    minutesToWarning,
    minutesToCritical,
    coolingRequirementNote,
    longTermDriftCelsius,
    generatedAt,
  };
}
