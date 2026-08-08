import type { PowerHistoryPoint } from './types.js';

export interface HistoryQuery {
  deviceId?: string;
  from?: string;
  to?: string;
}

/**
 * §7 — interim in-memory historical store until Database Authority provides
 * persistent retention.
 */
export class PowerHistoryStore {
  private points: PowerHistoryPoint[] = [];

  append(point: PowerHistoryPoint): void {
    this.points.push({ ...point });
  }

  appendMany(points: PowerHistoryPoint[]): void {
    for (const point of points) {
      this.append(point);
    }
  }

  query(query: HistoryQuery = {}): PowerHistoryPoint[] {
    let results = [...this.points];

    if (query.deviceId) {
      results = results.filter((p) => p.deviceId === query.deviceId);
    }
    if (query.from) {
      results = results.filter((p) => p.timestamp >= query.from!);
    }
    if (query.to) {
      results = results.filter((p) => p.timestamp <= query.to!);
    }

    return results.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  forDevice(deviceId: string): PowerHistoryPoint[] {
    return this.query({ deviceId });
  }

  count(): number {
    return this.points.length;
  }

  clear(): void {
    this.points = [];
  }
}
