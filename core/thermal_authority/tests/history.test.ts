import { describe, expect, it } from 'vitest';
import { ThermalHistoryStore, computeHistorySummary } from '../src/history.js';
import { makeHistoryPoints } from './testHelpers.js';

describe('Thermal history', () => {
  it('appends and queries history points', () => {
    const store = new ThermalHistoryStore();
    const point = { deviceId: 'gpu-0', celsius: 65, recordedAt: new Date().toISOString() };
    store.append(point);
    expect(store.forDevice('gpu-0')).toHaveLength(1);
  });

  it('query() respects limit', () => {
    const store = new ThermalHistoryStore();
    const points = makeHistoryPoints('gpu-0', [60, 62, 64, 66, 68]);
    store.appendMany(points);
    const result = store.query({ deviceId: 'gpu-0', limit: 3 });
    expect(result).toHaveLength(3);
    expect(result[0].celsius).toBe(64);
  });

  it('query() filters by since timestamp', () => {
    const base = Date.now();
    const store = new ThermalHistoryStore();
    store.appendMany(makeHistoryPoints('gpu-0', [60, 65, 70], base, 60_000));
    const since = new Date(base + 60_000).toISOString();
    const result = store.query({ deviceId: 'gpu-0', since });
    expect(result).toHaveLength(2);
  });

  it('count() returns total or per-device count', () => {
    const store = new ThermalHistoryStore();
    store.append({ deviceId: 'gpu-0', celsius: 65, recordedAt: new Date().toISOString() });
    store.append({ deviceId: 'cpu-0', celsius: 55, recordedAt: new Date().toISOString() });
    expect(store.count()).toBe(2);
    expect(store.count('gpu-0')).toBe(1);
  });

  it('clear() removes all points', () => {
    const store = new ThermalHistoryStore();
    store.append({ deviceId: 'gpu-0', celsius: 65, recordedAt: new Date().toISOString() });
    store.clear();
    expect(store.count()).toBe(0);
  });

  it('computeHistorySummary() calculates statistics', () => {
    const points = makeHistoryPoints('gpu-0', [60, 70, 80]);
    const summary = computeHistorySummary(points);
    expect(summary.pointCount).toBe(3);
    expect(summary.averageCelsius).toBe(70);
    expect(summary.peakCelsius).toBe(80);
    expect(summary.minCelsius).toBe(60);
    expect(summary.variance).toBeGreaterThan(0);
  });

  it('computeHistorySummary() handles empty input', () => {
    const summary = computeHistorySummary([]);
    expect(summary.pointCount).toBe(0);
    expect(summary.averageCelsius).toBe(0);
  });
});
