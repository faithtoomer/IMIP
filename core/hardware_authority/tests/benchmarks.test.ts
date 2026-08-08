import { describe, expect, it } from 'vitest';
import { BenchmarkRegistry } from '../src/benchmarks.js';
import type { BenchmarkResult } from '../src/types.js';

function result(overrides: Partial<BenchmarkResult> = {}): BenchmarkResult {
  return {
    deviceId: 'gpu-1',
    workload: 'gpu-mining',
    metric: 'hashes-per-second',
    value: 4200,
    unit: 'H/s',
    recordedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('BenchmarkRegistry (§11)', () => {
  it('stores results and returns them per device', () => {
    const registry = new BenchmarkRegistry();
    registry.record(result());
    expect(registry.forDevice('gpu-1')).toHaveLength(1);
    expect(registry.forDevice('other-device')).toHaveLength(0);
  });

  it('summarize() reports the latest and best result per workload', () => {
    const registry = new BenchmarkRegistry();
    registry.record(result({ value: 4000, recordedAt: '2026-01-01T00:00:00.000Z' }));
    registry.record(result({ value: 4500, recordedAt: '2026-01-02T00:00:00.000Z' }));
    registry.record(result({ value: 3000, recordedAt: '2026-01-03T00:00:00.000Z' }));

    const summary = registry.summarize('gpu-1');
    expect(summary.totalResults).toBe(3);
    expect(summary.latestByWorkload['gpu-mining'].recordedAt).toBe('2026-01-03T00:00:00.000Z');
    expect(summary.bestByWorkload['gpu-mining'].value).toBe(4500);
  });

  it('tracks multiple workloads independently', () => {
    const registry = new BenchmarkRegistry();
    registry.record(result({ workload: 'gpu-mining', value: 4200 }));
    registry.record(result({ workload: 'ai-inference', metric: 'tokens-per-second', value: 120, unit: 't/s' }));

    const summary = registry.summarize('gpu-1');
    expect(Object.keys(summary.latestByWorkload).sort()).toEqual(['ai-inference', 'gpu-mining']);
  });

  it('records are immutable once stored', () => {
    const registry = new BenchmarkRegistry();
    registry.record(result());
    const [stored] = registry.forDevice('gpu-1');
    expect(Object.isFrozen(stored)).toBe(true);
  });
});
