import { describe, expect, it } from 'vitest';
import { aggregateMetrics } from '../src/aggregation.js';
import { MiningStatisticsFramework } from '../src/MiningStatisticsFramework.js';
import { MINING_STATISTICS_EVENTS } from '../src/events.js';
import { bucketStart } from '../src/rollups.js';
import { DataQualityRejectionReason } from '../src/types.js';
import { dependencies, metric } from './testHelpers.js';

describe('Institutional Mining Statistics Framework', () => {
  it('constructs canonical immutable metrics and never regenerates a Metric UUID for the same ingestion event', () => {
    const d = dependencies();
    const framework = new MiningStatisticsFramework(d);
    const first = framework.ingest(metric({ ingestionId: 'adapter-event-1' }));
    const repeated = framework.ingest(metric({ ingestionId: 'adapter-event-1', value: 999 }));
    expect(first.metric).toMatchObject({ metricUuid: 'test-uuid-1', sourceIdentifier: 'source-1', workloadUuid: 'workload-1', adapterUuid: 'adapter-1', minerProcessUuid: 'process-1', hardwareIdentifier: 'hardware-1', algorithmIdentifier: 'algorithm-1', value: 100, unit: 'H/s', confidenceScore: 0.9, collectionStatus: 'collected' });
    expect(Object.isFrozen(first.metric)).toBe(true);
    expect(repeated.metric).toBe(first.metric);
    expect(d.dataProvider.created).toHaveLength(1);
  });

  it('accepts IMAF-shaped already-normalized values without raw-output normalization or value conversion', () => {
    const framework = new MiningStatisticsFramework(dependencies());
    const normalized = { hashrateHps: 123, acceptedShares: 9, rejectedShares: 1, workerStatus: 'running', extensions: { vendorRaw: 'already handled by adapter' } };
    const results = framework.ingestNormalizedStatistics({
      sourceIdentifier: 'adapter-normalized-source',
      workloadUuid: 'workload-1',
      adapterUuid: 'adapter-1',
      minerProcessUuid: 'process-1',
      hardwareIdentifier: 'hardware-1',
      resourceUuid: 'resource-1',
      pluginUuid: 'plugin-1',
      algorithmIdentifier: 'algorithm-1',
      poolIdentifier: 'pool-1',
      ingestionIdPrefix: 'normalized-event',
    }, normalized);
    expect(results.map((result) => [result.metric.metricType, result.metric.value])).toEqual([
      ['hashrate-hps', 123], ['accepted-shares', 9], ['rejected-shares', 1],
    ]);
    expect(normalized).toEqual({ hashrateHps: 123, acceptedShares: 9, rejectedShares: 1, workerStatus: 'running', extensions: { vendorRaw: 'already handled by adapter' } });
  });

  it('rejects negative hashrate, NaN, invalid confidence, and decreasing share counts with distinct reasons', () => {
    const framework = new MiningStatisticsFramework(dependencies());
    const negative = framework.ingest(metric({ ingestionId: 'negative', value: -1 }));
    const nan = framework.ingest(metric({ ingestionId: 'nan', value: Number.NaN }));
    const confidence = framework.ingest(metric({ ingestionId: 'confidence', confidenceScore: 1.1 }));
    framework.ingest(metric({ ingestionId: 'shares-10', timestamp: '2026-08-09T14:00:00.000Z', metricType: 'accepted-shares', value: 10, unit: 'shares' }));
    const decreasing = framework.ingest(metric({ ingestionId: 'shares-9', timestamp: '2026-08-09T14:01:00.000Z', metricType: 'accepted-shares', value: 9, unit: 'shares' }));
    expect([negative, nan, confidence, decreasing].map((result) => result.metric.collectionStatus)).toEqual(['rejected', 'rejected', 'rejected', 'rejected']);
    expect([negative, nan, confidence, decreasing].map((result) => result.rejectionReason)).toEqual([DataQualityRejectionReason.NegativeHashrate, DataQualityRejectionReason.NonFiniteValue, DataQualityRejectionReason.ConfidenceOutOfRange, DataQualityRejectionReason.DecreasingShareCount]);
  });

  it('detects deterministic hashrate drop/spike, share-rejection-rate, and efficiency anomalies and quarantines rather than drops them', () => {
    const build = () => new MiningStatisticsFramework(dependencies(), { hashrateDropRatio: 0.75, hashrateSpikeRatio: 1.2, shareRejectionRateThreshold: 0.05, efficiencyDeviationRatio: 0.1 });
    const run = (framework: MiningStatisticsFramework) => {
      framework.ingest(metric({ ingestionId: 'hash-base', value: 100 }));
      const drop = framework.ingest(metric({ ingestionId: 'hash-drop', timestamp: '2026-08-09T14:01:00.000Z', value: 50 }));
      const spike = framework.ingest(metric({ ingestionId: 'hash-spike', timestamp: '2026-08-09T14:02:00.000Z', value: 250 }));
      framework.ingest(metric({ ingestionId: 'eff-base', timestamp: '2026-08-09T14:00:00.000Z', metricType: 'efficiency-hps-per-watt', unit: 'H/s/W', value: 10 }));
      const efficiency = framework.ingest(metric({ ingestionId: 'eff-low', timestamp: '2026-08-09T14:01:00.000Z', metricType: 'efficiency-hps-per-watt', unit: 'H/s/W', value: 5 }));
      framework.ingest(metric({ ingestionId: 'accepted', timestamp: '2026-08-09T14:03:00.000Z', metricType: 'accepted-shares', unit: 'shares', value: 90 }));
      const rejected = framework.ingest(metric({ ingestionId: 'rejected', timestamp: '2026-08-09T14:03:00.000Z', metricType: 'rejected-shares', unit: 'shares', value: 10 }));
      return { drop, spike, efficiency, rejected };
    };
    const first = run(build());
    const second = run(build());
    expect(first.drop.anomalies.map((entry) => entry.type)).toEqual(['hashrate-drop']);
    expect(first.spike.anomalies.map((entry) => entry.type)).toEqual(['hashrate-spike']);
    expect(first.efficiency.anomalies.map((entry) => entry.type)).toEqual(['efficiency-anomaly']);
    expect(first.rejected.anomalies.map((entry) => entry.type)).toEqual(['share-rejection-rate-spike']);
    expect(first.drop.metric.collectionStatus).toBe('quarantined');
    expect(first.drop.metric.metricUuid).toBeTruthy();
    expect(first).toEqual(second);
  });

  it('aggregates pure deterministic sums at every institutional level', () => {
    const framework = new MiningStatisticsFramework(dependencies(), { hashrateDropRatio: 0, hashrateSpikeRatio: 100, efficiencyDeviationRatio: 100, shareRejectionRateThreshold: 1 });
    framework.ingest(metric({ ingestionId: 'one', value: 10 }));
    framework.ingest(metric({ ingestionId: 'two', timestamp: '2026-08-09T14:01:00.000Z', value: 30 }));
    framework.ingest(metric({ ingestionId: 'three', timestamp: '2026-08-09T14:00:00.000Z', sourceIdentifier: 'source-2', workloadUuid: 'workload-2', adapterUuid: 'adapter-2', minerProcessUuid: 'process-2', hardwareIdentifier: 'hardware-2', pluginUuid: 'plugin-2', algorithmIdentifier: 'algorithm-2', poolIdentifier: 'pool-2', value: 20 }));
    const expected: [Parameters<MiningStatisticsFramework['aggregate']>[0], string, number][] = [
      ['device', 'hardware-1', 40], ['workload', 'workload-1', 40], ['miner-process', 'process-1', 40], ['plugin', 'plugin-1', 40], ['adapter-algorithm', 'adapter-1:algorithm-1', 40], ['pool', 'pool-1', 40], ['platform', 'platform', 60],
    ];
    for (const [level, key, sum] of expected) expect(framework.aggregate(level).find((entry) => entry.aggregationKey === key && entry.metricType === 'hashrate-hps')?.sum).toBe(sum);
    expect(aggregateMetrics(framework.query(), 'platform')).toEqual(aggregateMetrics([...framework.query()].reverse(), 'platform'));
  });

  it('computes UTC minute/hour/day/week rollups and delegates durable persistence, retention, and archive governance', () => {
    const d = dependencies();
    const framework = new MiningStatisticsFramework(d, { hashrateDropRatio: 0, hashrateSpikeRatio: 100, efficiencyDeviationRatio: 100, shareRejectionRateThreshold: 1 });
    framework.ingest(metric({ ingestionId: 'rollup', timestamp: '2026-08-09T14:03:45.123Z', value: 10 }));
    expect(bucketStart('2026-08-09T14:03:45.123Z', 'minute')).toBe('2026-08-09T14:03:00.000Z');
    expect(bucketStart('2026-08-09T14:03:45.123Z', 'hour')).toBe('2026-08-09T14:00:00.000Z');
    expect(bucketStart('2026-08-09T14:03:45.123Z', 'day')).toBe('2026-08-09T00:00:00.000Z');
    expect(bucketStart('2026-08-09T14:03:45.123Z', 'week')).toBe('2026-08-03T00:00:00.000Z');
    const rollups = (['minute', 'hour', 'day', 'week'] as const).flatMap((granularity) => framework.rollup(granularity));
    expect(rollups.map((rollup) => rollup.sum)).toEqual([10, 10, 10, 10]);
    expect(d.dataProvider.created.filter((entry) => entry.domain === 'mining-statistics-rollup')).toHaveLength(4);
    expect(d.retentionProvider.retained).toHaveLength(4);
    framework.archiveRollups(rollups, 'fixture archive request');
    expect(d.retentionProvider.archived).toEqual([{ rollups, reason: 'fixture archive request' }]);
  });

  it('publishes all seven events, explains dispositions/aggregates, and traces the full institutional telemetry chain', () => {
    const framework = new MiningStatisticsFramework(dependencies(), { hashrateDropRatio: 0.8, hashrateSpikeRatio: 99, efficiencyDeviationRatio: 0.1, shareRejectionRateThreshold: 0.05 });
    const received: string[] = [];
    for (const event of Object.values(MINING_STATISTICS_EVENTS)) framework.events.subscribe(event, () => received.push(event));
    const base = framework.ingest(metric({ ingestionId: 'event-hash', value: 100 }));
    framework.ingest(metric({ ingestionId: 'event-hash-drop', timestamp: '2026-08-09T14:01:00.000Z', value: 50 }));
    framework.ingest(metric({ ingestionId: 'event-accepted', timestamp: '2026-08-09T14:02:00.000Z', metricType: 'accepted-shares', unit: 'shares', value: 90 }));
    framework.ingest(metric({ ingestionId: 'event-rejected', timestamp: '2026-08-09T14:02:00.000Z', metricType: 'rejected-shares', unit: 'shares', value: 10 }));
    framework.ingest(metric({ ingestionId: 'event-eff', metricType: 'efficiency-hps-per-watt', unit: 'H/s/W', value: 10 }));
    framework.ingest(metric({ ingestionId: 'event-eff-drop', timestamp: '2026-08-09T14:03:00.000Z', metricType: 'efficiency-hps-per-watt', unit: 'H/s/W', value: 5 }));
    framework.ingest(metric({ ingestionId: 'event-invalid', timestamp: '2026-08-09T14:04:00.000Z', value: -1 }));
    expect(new Set(received)).toEqual(new Set(Object.values(MINING_STATISTICS_EVENTS)));
    expect(framework.explain(base.metric.metricUuid)).toMatchObject({ disposition: 'accepted', rationale: expect.stringContaining('accepted') });
    expect(framework.explainAggregate('platform', 'platform', 'hashrate-hps')).toMatchObject({ sum: 100, metricUuids: [base.metric.metricUuid] });
    expect(framework.graph.chain(base.metric.metricUuid).map((node) => node.kind)).toEqual(['hardware', 'resource', 'workload', 'miner-process', 'adapter', 'algorithm', 'pool', 'statistics']);
    expect(framework.graph.traceHardware('hardware-1')).toHaveLength(7);
  });

  it('keeps concurrent multi-source ingestion isolated while persisting every canonical result', async () => {
    const d = dependencies();
    const framework = new MiningStatisticsFramework(d, { hashrateDropRatio: 0, hashrateSpikeRatio: 100, efficiencyDeviationRatio: 100, shareRejectionRateThreshold: 1 });
    const results = await Promise.all([
      Promise.resolve().then(() => framework.ingest(metric({ ingestionId: 'concurrent-1', sourceIdentifier: 'source-a', workloadUuid: 'workload-a', hardwareIdentifier: 'hardware-a', value: 10 }))),
      Promise.resolve().then(() => framework.ingest(metric({ ingestionId: 'concurrent-2', sourceIdentifier: 'source-b', workloadUuid: 'workload-b', hardwareIdentifier: 'hardware-b', value: 20 }))),
      Promise.resolve().then(() => framework.ingest(metric({ ingestionId: 'concurrent-3', sourceIdentifier: 'source-c', workloadUuid: 'workload-c', hardwareIdentifier: 'hardware-c', value: 30 }))),
    ]);
    expect(results.every((result) => result.accepted)).toBe(true);
    expect(framework.query()).toHaveLength(3);
    expect(framework.aggregate('platform').find((entry) => entry.metricType === 'hashrate-hps')?.sum).toBe(60);
    expect(d.dataProvider.created.filter((entry) => entry.domain === 'mining-statistics')).toHaveLength(3);
  });
});
