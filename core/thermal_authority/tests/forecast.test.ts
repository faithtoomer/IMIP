import { describe, expect, it } from 'vitest';
import { generateForecast } from '../src/forecast.js';
import { createDefaultBudget } from '../src/budgets.js';
import type { ThermalTrend } from '../src/types.js';

describe('Thermal forecast', () => {
  const budget = createDefaultBudget('gpu');

  it('forecasts expected temperature 15 minutes ahead', () => {
    const trend: ThermalTrend = {
      slopeCelsiusPerMinute: 0.5,
      heatAccumulationRate: 0.5,
      coolingRate: 0,
      cyclingFrequency: 0,
      window: '15m',
    };
    const forecast = generateForecast({
      currentCelsius: 70,
      trend,
      budget,
      generatedAt: new Date().toISOString(),
    });
    expect(forecast.expectedCelsius).toBe(70 + 0.5 * 15);
  });

  it('computes minutesToWarning when heating', () => {
    const trend: ThermalTrend = {
      slopeCelsiusPerMinute: 1,
      heatAccumulationRate: 1,
      coolingRate: 0,
      cyclingFrequency: 0,
      window: '15m',
    };
    const forecast = generateForecast({
      currentCelsius: 70,
      trend,
      budget,
      generatedAt: new Date().toISOString(),
    });
    expect(forecast.minutesToWarning).toBe(13);
  });

  it('computes minutesToCritical when heating', () => {
    const trend: ThermalTrend = {
      slopeCelsiusPerMinute: 1,
      heatAccumulationRate: 1,
      coolingRate: 0,
      cyclingFrequency: 0,
      window: '15m',
    };
    const forecast = generateForecast({
      currentCelsius: 70,
      trend,
      budget,
      generatedAt: new Date().toISOString(),
    });
    expect(forecast.minutesToCritical).toBe(25);
  });

  it('omits ETA when temperature is falling', () => {
    const trend: ThermalTrend = {
      slopeCelsiusPerMinute: -0.5,
      heatAccumulationRate: 0,
      coolingRate: 0.5,
      cyclingFrequency: 0,
      window: '15m',
    };
    const forecast = generateForecast({
      currentCelsius: 70,
      trend,
      budget,
      generatedAt: new Date().toISOString(),
    });
    expect(forecast.minutesToWarning).toBeUndefined();
    expect(forecast.minutesToCritical).toBeUndefined();
  });

  it('includes cooling requirement note when above warning threshold', () => {
    const trend: ThermalTrend = {
      slopeCelsiusPerMinute: 0.1,
      heatAccumulationRate: 0.1,
      coolingRate: 0,
      cyclingFrequency: 0,
      window: '15m',
    };
    const forecast = generateForecast({
      currentCelsius: 85,
      trend,
      budget,
      generatedAt: new Date().toISOString(),
    });
    expect(forecast.coolingRequirementNote).toMatch(/warning threshold/i);
  });

  it('computes longTermDriftCelsius over 24 hours', () => {
    const trend: ThermalTrend = {
      slopeCelsiusPerMinute: 0.1,
      heatAccumulationRate: 0.1,
      coolingRate: 0,
      cyclingFrequency: 0,
      window: '15m',
    };
    const forecast = generateForecast({
      currentCelsius: 70,
      trend,
      budget,
      generatedAt: new Date().toISOString(),
    });
    expect(forecast.longTermDriftCelsius).toBe(0.1 * 60 * 24);
  });
});
