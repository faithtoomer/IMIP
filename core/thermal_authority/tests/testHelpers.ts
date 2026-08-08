import type { ThermalSample } from '../src/types.js';

export function makeSample(overrides: Partial<ThermalSample> = {}): ThermalSample {
  return {
    deviceId: 'gpu-0',
    deviceType: 'gpu',
    celsius: 65,
    coreCelsius: 63,
    memoryCelsius: 58,
    fanRpm: 1500,
    ambientCelsius: 22,
    collectedAt: new Date().toISOString(),
    sensorAvailable: true,
    ...overrides,
  };
}

export function makeSampleSeries(
  deviceId: string,
  temps: number[],
  baseTime = Date.now(),
  intervalMs = 60_000,
): ThermalSample[] {
  return temps.map((celsius, i) =>
    makeSample({
      deviceId,
      celsius,
      collectedAt: new Date(baseTime + i * intervalMs).toISOString(),
    }),
  );
}

export function makeHistoryPoints(
  deviceId: string,
  temps: number[],
  baseTime = Date.now(),
  intervalMs = 60_000,
) {
  return temps.map((celsius, i) => ({
    deviceId,
    celsius,
    recordedAt: new Date(baseTime + i * intervalMs).toISOString(),
  }));
}
