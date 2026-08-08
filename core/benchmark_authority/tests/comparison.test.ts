import { describe, expect, it } from 'vitest';
import { compareBenchmarkRuns, performanceTrend } from '../src/comparison.js';
import { FakeIHISBenchmarkRegistry, completeToStored, makeAuthority, makeInput } from './testHelpers.js';

describe('IBIA comparative analysis and regression detection', () => {
  it('compares against a compatible historical baseline and detects a directional regression', () => {
    const authority = makeAuthority({ providers: { hardwareStore: new FakeIHISBenchmarkRegistry() }, regressionThresholdPercent: 5 });
    const baseline = completeToStored(authority, makeInput(), 100);
    authority.compare(baseline.runId);
    authority.archive(baseline.runId);
    const current = completeToStored(authority, makeInput(), 80);
    const comparison = authority.compare(current.runId);
    expect(comparison).toMatchObject({ baselineRunId: baseline.runId, directionalChange: -20, directionalChangePercent: -20, classification: 'regressed', regressionDetected: true });
    expect(authority.getPerformanceTrend('mining-randomx-hashrate', 'gpu', '1.0.0')).toBe('declining');
  });

  it('uses lower-is-better directionality for platform latency and reports improvement', () => {
    const authority = makeAuthority({ providers: { hardwareStore: new FakeIHISBenchmarkRegistry() } });
    authority.registerBenchmarkType({
      ...authority.catalog.require('mining-randomx-hashrate', '1.0.0'),
      typeId: 'platform-runtime-latency', category: 'platform', name: 'Runtime latency', metric: 'latency', unit: 'ms', direction: 'lower-is-better',
    });
    const first = completeToStored(authority, makeInput({ benchmarkTypeId: 'platform-runtime-latency', component: 'runtime' }), 100);
    authority.compare(first.runId);
    authority.archive(first.runId);
    const next = completeToStored(authority, makeInput({ benchmarkTypeId: 'platform-runtime-latency', component: 'runtime' }), 80);
    expect(authority.compare(next.runId)).toMatchObject({ classification: 'improved', directionalChange: 20, directionalChangePercent: 20 });
  });

  it('gives no baseline for an initial run and trend analysis requires two observations', () => {
    const authority = makeAuthority({ providers: { hardwareStore: new FakeIHISBenchmarkRegistry() } });
    const run = completeToStored(authority, makeInput(), 100);
    expect(authority.compare(run.runId).classification).toBe('no-baseline');
    expect(performanceTrend([authority.getRun(run.runId)], 'higher-is-better')).toBe('insufficient-data');
    expect(compareBenchmarkRuns(authority.getRun(run.runId), undefined, 'higher-is-better', { now: '2026-08-08T20:00:00.000Z' }).baselineDescription).toContain('No comparable');
  });

  it('treats a zero-valued baseline as comparable but avoids inventing a percentage change', () => {
    const authority = makeAuthority({ providers: { hardwareStore: new FakeIHISBenchmarkRegistry() } });
    const zero = completeToStored(authority, makeInput(), 0);
    authority.compare(zero.runId);
    authority.archive(zero.runId);
    const positive = completeToStored(authority, makeInput(), 10);
    expect(authority.compare(positive.runId)).toMatchObject({ baselineValue: 0, directionalChange: 10, directionalChangePercent: undefined, classification: 'stable' });
  });
});
