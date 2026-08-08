import { describe, expect, it } from 'vitest';
import {
  validateTemperature,
  diagnoseProfile,
  checkSensorDrift,
  resolveThermalState,
} from '../src/diagnostics.js';
import { ThermalDiagnosticError } from '../src/errors.js';
import type { ThermalProfile } from '../src/types.js';
import { makeHistoryPoints } from './testHelpers.js';

describe('Thermal diagnostics', () => {
  it('validateTemperature() rejects NaN', () => {
    expect(() => validateTemperature(NaN, 'gpu-0')).toThrow(ThermalDiagnosticError);
  });

  it('validateTemperature() rejects impossible low temps', () => {
    expect(() => validateTemperature(-100, 'gpu-0')).toThrow(/Impossible temperature/);
  });

  it('validateTemperature() rejects impossible high temps', () => {
    expect(() => validateTemperature(200, 'gpu-0')).toThrow(/Impossible temperature/);
  });

  it('diagnoseProfile() passes valid profile', () => {
    const result = diagnoseProfile({
      deviceId: 'gpu-0',
      deviceType: 'gpu',
      currentCelsius: 65,
      thermalState: 'nominal',
      lifecycleStage: 'monitored',
      lastUpdated: new Date().toISOString(),
      sensorAvailable: true,
    });
    expect(result.valid).toBe(true);
  });

  it('diagnoseProfile() flags NaN temperature', () => {
    const result = diagnoseProfile({
      deviceId: 'gpu-0',
      deviceType: 'gpu',
      currentCelsius: NaN,
      thermalState: 'unknown',
      lifecycleStage: 'monitored',
      lastUpdated: new Date().toISOString(),
      sensorAvailable: true,
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Current temperature is NaN');
  });

  it('checkSensorDrift() detects large drift from baseline', () => {
    const profile: ThermalProfile = {
      deviceId: 'gpu-0',
      deviceType: 'gpu',
      currentCelsius: 95,
      thermalState: 'warning',
      lifecycleStage: 'monitored',
      lastUpdated: new Date().toISOString(),
      sensorAvailable: true,
    };
    const history = makeHistoryPoints('gpu-0', [60, 62]);
    const result = checkSensorDrift(profile, history);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatch(/drift/i);
  });

  it('resolveThermalState() returns correct states', () => {
    const budget = { operatingTargetCelsius: 65, warningThresholdCelsius: 80, criticalThresholdCelsius: 95 };
    expect(resolveThermalState(60, budget, true)).toBe('nominal');
    expect(resolveThermalState(70, budget, true)).toBe('elevated');
    expect(resolveThermalState(82, budget, true)).toBe('warning');
    expect(resolveThermalState(96, budget, true)).toBe('critical');
    expect(resolveThermalState(60, budget, false)).toBe('unknown');
  });
});
