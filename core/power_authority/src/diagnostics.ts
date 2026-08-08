import { PowerInvalidTelemetryError } from './errors.js';
import type { PowerSample } from './types.js';

export interface DiagnosticResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * §18 — validate power telemetry samples. Missing sensors are first-class
 * (sensorAvailable: false) and produce warnings, not hard failures.
 */
export function validateSample(sample: PowerSample): DiagnosticResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!sample.deviceId) {
    errors.push('Sample missing deviceId.');
  }

  if (!sample.sensorAvailable) {
    warnings.push(`Sensor unavailable for device "${sample.deviceId}".`);
    return { valid: errors.length === 0, errors, warnings };
  }

  if (!Number.isFinite(sample.watts)) {
    errors.push(`Invalid watts value (NaN/Infinity) for device "${sample.deviceId}".`);
  } else if (sample.watts < 0) {
    errors.push(`Negative watts (${sample.watts}) for device "${sample.deviceId}".`);
  }

  if (sample.maximumRatedWatts !== undefined) {
    if (!Number.isFinite(sample.maximumRatedWatts) || sample.maximumRatedWatts <= 0) {
      errors.push(`Invalid maximumRatedWatts for device "${sample.deviceId}".`);
    } else if (Number.isFinite(sample.watts) && sample.watts > sample.maximumRatedWatts * 2) {
      errors.push(
        `Impossible watts (${sample.watts}) exceeds 2x maximum rated (${sample.maximumRatedWatts}) for device "${sample.deviceId}".`,
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidSample(sample: PowerSample): void {
  const result = validateSample(sample);
  if (!result.valid) {
    throw new PowerInvalidTelemetryError(result.errors.join(' '));
  }
}

export function isSensorUnavailable(sample: PowerSample): boolean {
  return !sample.sensorAvailable;
}
