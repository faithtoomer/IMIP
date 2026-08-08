import type { ThermalHistoryPoint } from './types.js';

export interface HistoryQuery {
  deviceId: string;
  since?: string;
  until?: string;
  limit?: number;
}

/**
 * In-memory thermal history store with query support.
 * Interim implementation until Data Authority provides persistent storage.
 */
export class ThermalHistoryStore {
  private points: ThermalHistoryPoint[] = [];

  append(point: ThermalHistoryPoint): void {
    this.points.push(point);
  }

  appendMany(points: ThermalHistoryPoint[]): void {
    this.points.push(...points);
  }

  query(query: HistoryQuery): ThermalHistoryPoint[] {
    let results = this.points.filter((point) => point.deviceId === query.deviceId);

    if (query.since) {
      const sinceMs = Date.parse(query.since);
      results = results.filter((point) => Date.parse(point.recordedAt) >= sinceMs);
    }
    if (query.until) {
      const untilMs = Date.parse(query.until);
      results = results.filter((point) => Date.parse(point.recordedAt) <= untilMs);
    }

    results.sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));

    if (query.limit !== undefined && query.limit >= 0) {
      results = results.slice(-query.limit);
    }

    return results;
  }

  forDevice(deviceId: string): ThermalHistoryPoint[] {
    return this.query({ deviceId });
  }

  count(deviceId?: string): number {
    if (deviceId) return this.points.filter((p) => p.deviceId === deviceId).length;
    return this.points.length;
  }

  clear(): void {
    this.points = [];
  }
}

export function computeHistorySummary(points: ThermalHistoryPoint[]): {
  pointCount: number;
  averageCelsius: number;
  peakCelsius: number;
  minCelsius: number;
  variance: number;
} {
  if (points.length === 0) {
    return { pointCount: 0, averageCelsius: 0, peakCelsius: 0, minCelsius: 0, variance: 0 };
  }

  const temps = points.map((p) => p.celsius);
  const sum = temps.reduce((a, b) => a + b, 0);
  const average = sum / temps.length;
  const peak = Math.max(...temps);
  const min = Math.min(...temps);
  const variance = temps.reduce((acc, t) => acc + (t - average) ** 2, 0) / temps.length;

  return {
    pointCount: points.length,
    averageCelsius: average,
    peakCelsius: peak,
    minCelsius: min,
    variance,
  };
}
