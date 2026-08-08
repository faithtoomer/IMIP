import type { ThermalHistoryPoint, ThermalProfile } from './types.js';
import { ThermalDiagnosticError } from './errors.js';

const MIN_VALID_CELSIUS = -50;
const MAX_VALID_CELSIUS = 150;
const DRIFT_THRESHOLD_CELSIUS = 30;

export interface DiagnosticResult {
  valid: boolean;
  issues: string[];
}

export function validateTemperature(celsius: number, deviceId: string): void {
  if (Number.isNaN(celsius)) {
    throw new ThermalDiagnosticError(deviceId, `Temperature is NaN for device "${deviceId}"`);
  }
  if (celsius < MIN_VALID_CELSIUS || celsius > MAX_VALID_CELSIUS) {
    throw new ThermalDiagnosticError(
      deviceId,
      `Impossible temperature ${celsius}°C for device "${deviceId}" (valid range: ${MIN_VALID_CELSIUS} to ${MAX_VALID_CELSIUS})`,
    );
  }
}

export function diagnoseProfile(profile: ThermalProfile): DiagnosticResult {
  const issues: string[] = [];

  if (Number.isNaN(profile.currentCelsius)) {
    issues.push('Current temperature is NaN');
  } else if (profile.currentCelsius < MIN_VALID_CELSIUS || profile.currentCelsius > MAX_VALID_CELSIUS) {
    issues.push(`Impossible current temperature: ${profile.currentCelsius}°C`);
  }

  const optionalTemps: [string, number | undefined][] = [
    ['core', profile.coreCelsius],
    ['memory', profile.memoryCelsius],
    ['hotspot', profile.hotspotCelsius],
    ['vrm', profile.vrmCelsius],
    ['ambient', profile.ambientCelsius],
  ];

  for (const [label, value] of optionalTemps) {
    if (value === undefined) continue;
    if (Number.isNaN(value)) {
      issues.push(`${label} temperature is NaN`);
    } else if (value < MIN_VALID_CELSIUS || value > MAX_VALID_CELSIUS) {
      issues.push(`Impossible ${label} temperature: ${value}°C`);
    }
  }

  if (profile.fanRpm !== undefined && (profile.fanRpm < 0 || profile.fanRpm > 50_000)) {
    issues.push(`Suspicious fan RPM: ${profile.fanRpm}`);
  }

  return { valid: issues.length === 0, issues };
}

export function checkSensorDrift(
  profile: ThermalProfile,
  history: ThermalHistoryPoint[],
): DiagnosticResult {
  const issues: string[] = [];

  if (history.length < 2) {
    return { valid: true, issues };
  }

  const baseline = history[0].celsius;
  const drift = Math.abs(profile.currentCelsius - baseline);

  if (drift > DRIFT_THRESHOLD_CELSIUS && profile.sensorAvailable) {
    issues.push(`Sensor drift of ${drift.toFixed(1)}°C detected from baseline ${baseline}°C`);
  }

  return { valid: issues.length === 0, issues };
}

export function resolveThermalState(
  celsius: number,
  budget: { warningThresholdCelsius: number; criticalThresholdCelsius: number; operatingTargetCelsius: number },
  sensorAvailable: boolean,
): ThermalProfile['thermalState'] {
  if (!sensorAvailable) return 'unknown';
  if (celsius >= budget.criticalThresholdCelsius) return 'critical';
  if (celsius >= budget.warningThresholdCelsius) return 'warning';
  if (celsius >= budget.operatingTargetCelsius) return 'elevated';
  return 'nominal';
}
