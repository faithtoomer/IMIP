import type { ThermalHistoryPoint, ThermalTrend } from './types.js';

const DEFAULT_WINDOW = '15m';

/** Linear regression slope (celsius per minute) over recent history points. */
export function linearRegressionSlope(points: ThermalHistoryPoint[]): number {
  if (points.length < 2) return 0;

  const baseTime = Date.parse(points[0].recordedAt);
  const xs = points.map((p) => (Date.parse(p.recordedAt) - baseTime) / 60_000);
  const ys = points.map((p) => p.celsius);
  const n = xs.length;

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

function computeCyclingFrequency(points: ThermalHistoryPoint[]): number {
  if (points.length < 3) return 0;

  let directionChanges = 0;
  let prevDirection = 0;

  for (let i = 1; i < points.length; i++) {
    const delta = points[i].celsius - points[i - 1].celsius;
    const direction = delta > 0.1 ? 1 : delta < -0.1 ? -1 : 0;
    if (direction !== 0 && prevDirection !== 0 && direction !== prevDirection) {
      directionChanges += 1;
    }
    if (direction !== 0) prevDirection = direction;
  }

  const durationMinutes =
    (Date.parse(points[points.length - 1].recordedAt) - Date.parse(points[0].recordedAt)) / 60_000;
  if (durationMinutes <= 0) return 0;

  return directionChanges / durationMinutes;
}

function computeHeatingRate(points: ThermalHistoryPoint[]): number {
  if (points.length < 2) return 0;

  let totalHeating = 0;
  let heatingMinutes = 0;

  for (let i = 1; i < points.length; i++) {
    const delta = points[i].celsius - points[i - 1].celsius;
    const minutes = (Date.parse(points[i].recordedAt) - Date.parse(points[i - 1].recordedAt)) / 60_000;
    if (minutes <= 0) continue;
    if (delta > 0) {
      totalHeating += delta;
      heatingMinutes += minutes;
    }
  }

  return heatingMinutes > 0 ? totalHeating / heatingMinutes : 0;
}

function computeCoolingRate(points: ThermalHistoryPoint[]): number {
  if (points.length < 2) return 0;

  let totalCooling = 0;
  let coolingMinutes = 0;

  for (let i = 1; i < points.length; i++) {
    const minutes = (Date.parse(points[i].recordedAt) - Date.parse(points[i - 1].recordedAt)) / 60_000;
    if (minutes <= 0) continue;
    const tempDelta = points[i].celsius - points[i - 1].celsius;
    if (tempDelta < 0) {
      totalCooling += Math.abs(tempDelta);
      coolingMinutes += minutes;
    }
  }

  return coolingMinutes > 0 ? totalCooling / coolingMinutes : 0;
}

export function computeTrend(points: ThermalHistoryPoint[], window = DEFAULT_WINDOW): ThermalTrend {
  const slope = linearRegressionSlope(points);
  const heatAccumulationRate = computeHeatingRate(points);
  const coolingRate = computeCoolingRate(points);
  const cyclingFrequency = computeCyclingFrequency(points);

  return {
    slopeCelsiusPerMinute: slope,
    heatAccumulationRate,
    coolingRate,
    cyclingFrequency,
    window,
  };
}
