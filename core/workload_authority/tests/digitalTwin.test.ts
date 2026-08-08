import { describe, expect, it } from 'vitest';
import { assembleWorkloadDigitalTwin } from '../src/digitalTwin.js';
import { assignAndStart, makeAuthority, makeClock, makeRequest, validatedQueued } from './testHelpers.js';

const profile = () => ({
  workloadId: 'twin-workload', type: 'ai-training' as const, owner: 'owner', state: 'running' as const,
  assignedResources: [], runtimeState: 'running' as const, estimatedDurationMs: 60_000, priority: 50,
  priorityReason: 'test', dependencies: [], resourceRequirements: {}, powerProfile: {}, thermalProfile: {},
  historicalPerformance: { completedRuns: 2, failedRuns: 1, successRate: 2 / 3, averageDurationMs: 50_000 },
  createdReason: 'test', createdAt: '2026-08-08T12:00:00.000Z', lastUpdated: '2026-08-08T12:00:00.000Z',
  startedAt: '2026-08-08T12:00:00.000Z',
});

describe('Institutional Workload Digital Twin (IWDT)', () => {
  it('assembles resource, thermal, power, efficiency, history, completion, and bottleneck dimensions', () => {
    const twin = assembleWorkloadDigitalTwin({
      profile: profile(), history: [], now: '2026-08-08T12:00:10.000Z',
      telemetry: [
        { workloadId: 'twin-workload', recordedAt: '2026-08-08T12:00:05.000Z', resourceUsage: { gpuPercent: 90, assignedResourceUtilizationPercent: 96 }, thermalCelsius: 92, powerWatts: 200, throughput: 100, idle: false },
        { workloadId: 'twin-workload', recordedAt: '2026-08-08T12:00:10.000Z', resourceUsage: { gpuPercent: 95, assignedResourceUtilizationPercent: 97 }, thermalCelsius: 94, powerWatts: 250, throughput: 150, idle: true },
      ],
    });
    expect(twin.resourceUsage.gpuPercent).toBe(95);
    expect(twin.thermalImpact).toMatchObject({ currentCelsius: 94, peakCelsius: 94, status: 'critical' });
    expect(twin.powerConsumption).toMatchObject({ currentWatts: 250, averageWatts: 225, peakWatts: 250 });
    expect(twin.runtimeEfficiency).toMatchObject({ averageThroughput: 125, throughputPerWatt: 125 / 225, idlePercent: 50 });
    expect(twin.historicalPerformance.successRate).toBeCloseTo(2 / 3);
    expect(twin.forecast.predictedCompletionAt).toBe('2026-08-08T12:00:50.000Z');
    expect(twin.bottlenecks.map((bottleneck) => bottleneck.kind)).toEqual(expect.arrayContaining(['resource-contention', 'thermal-pressure', 'idle-runtime']));
  });

  it('reports no-throughput from observed telemetry and a dependency-wait before execution', () => {
    const twin = assembleWorkloadDigitalTwin({
      profile: { ...profile(), state: 'queued', runtimeState: 'queued', startedAt: undefined, dependencies: ['first'] },
      history: [], now: '2026-08-08T12:00:10.000Z',
      telemetry: [{ workloadId: 'twin-workload', recordedAt: '2026-08-08T12:00:10.000Z', resourceUsage: {}, throughput: 0 }],
    });
    expect(twin.bottlenecks.map((bottleneck) => bottleneck.kind)).toEqual(expect.arrayContaining(['dependency-wait', 'no-throughput']));
    expect(twin.forecast.predictedCompletionAt).toBeUndefined();
  });

  it('updates the authority-owned IWDT as telemetry arrives', () => {
    const clock = makeClock();
    const authority = makeAuthority(new Map(), clock);
    const id = assignAndStart(authority, validatedQueued(authority, makeRequest()));
    clock.advance(10_000);
    const twin = authority.recordTelemetry({ workloadId: id, recordedAt: clock.now(), resourceUsage: { cpuPercent: 20 }, powerWatts: 100, throughput: 40 });
    expect(twin.workloadId).toBe(id);
    expect(twin.powerConsumption.averageWatts).toBe(100);
    expect(twin.forecast.estimatedRemainingMs).toBe(50_000);
  });
});
