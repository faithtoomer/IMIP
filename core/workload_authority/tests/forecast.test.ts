import { describe, expect, it } from 'vitest';
import { computeWorkloadForecast } from '../src/forecast.js';
import { WorkloadAuthority } from '../src/WorkloadAuthority.js';
import { assignAndStart, makeAuthority, makeClock, makeRequest, validatedQueued } from './testHelpers.js';

describe('Workload forecasting and advisory recommendations', () => {
  it('forecasts remaining runtime using estimated duration when history is absent', () => {
    const clock = makeClock();
    const authority = makeAuthority(new Map(), clock);
    const id = assignAndStart(authority, validatedQueued(authority, makeRequest()));
    clock.advance(15_000);
    const forecast = authority.getForecast(id);
    expect(forecast.estimatedRemainingMs).toBe(45_000);
    expect(forecast.predictedCompletionAt).toBe('2026-08-08T12:01:00.000Z');
    expect(forecast.confidence).toBe(0.35);
  });

  it('uses historical duration and reports observed queue delay', () => {
    const forecast = computeWorkloadForecast({
      profile: {
        workloadId: 'w', type: 'benchmarking', owner: 'owner', state: 'running', assignedResources: [], runtimeState: 'running',
        estimatedDurationMs: 1_000, priority: 50, priorityReason: 'test', dependencies: [], resourceRequirements: {}, powerProfile: {}, thermalProfile: {},
        historicalPerformance: { completedRuns: 5, failedRuns: 0, successRate: 1, averageDurationMs: 10_000 }, createdReason: 'test',
        createdAt: '2026-08-08T12:00:00.000Z', lastUpdated: '2026-08-08T12:00:00.000Z', startedAt: '2026-08-08T12:00:05.000Z',
      },
      history: [
        { timestamp: '2026-08-08T12:00:00.000Z', workloadId: 'w', kind: 'lifecycle', action: 'queued', details: {} },
        { timestamp: '2026-08-08T12:00:05.000Z', workloadId: 'w', kind: 'assignment', action: 'assigned', details: {} },
      ], telemetry: [], now: '2026-08-08T12:00:06.000Z',
    });
    expect(forecast.predictedCompletionAt).toBe('2026-08-08T12:00:15.000Z');
    expect(forecast.estimatedRemainingMs).toBe(9_000);
    expect(forecast.queueDelayMs).toBe(5_000);
    expect(forecast.confidence).toBe(0.85);
  });

  it('makes an advisory workload-side placement recommendation from provider input', () => {
    const seen: unknown[] = [];
    const authority = new WorkloadAuthority({
      now: () => '2026-08-08T12:00:00.000Z',
      resourceCandidateProvider: {
        rankCandidatesForWorkload(request) {
          seen.push(request);
          return [{ resourceId: 'iria-ranked-resource', score: 0.77, explanation: ['IRIA supplied this ranking.'] }];
        },
      },
    });
    const id = authority.createWorkload(makeRequest()).workloadId;
    authority.validate(id);
    authority.queue(id);
    const recommendation = authority.recommendPlacement(id);
    expect(recommendation).toMatchObject({ action: 'place-now', priority: 70, selectedCandidate: { resourceId: 'iria-ranked-resource', score: 0.77 } });
    expect(seen).toEqual([expect.objectContaining({ workloadId: id, workloadType: 'ai-inference', resourceRequirements: expect.objectContaining({ resourceType: 'gpu' }) })]);
  });

  it('recommends queueing when a validated workload has provider-ranked candidates', () => {
    const authority = makeAuthority(new Map([['validated', [{ resourceId: 'candidate', score: 0.9, explanation: [] }]]]));
    const id = authority.createWorkload(makeRequest({ workloadId: 'validated' })).workloadId;
    authority.validate(id);
    const recommendation = authority.recommendPlacement(id);
    expect(recommendation.action).toBe('queue');
    expect(recommendation.selectedCandidate?.resourceId).toBe('candidate');
    expect(authority.getWorkload(id).state).toBe('validated');
  });

  it('defers placement for dependencies and does not allocate resources', () => {
    const authority = makeAuthority(new Map([['child', [{ resourceId: 'would-be-resource', score: 1, explanation: [] }]]]));
    authority.createWorkload(makeRequest({ workloadId: 'parent' }));
    const child = authority.createWorkload(makeRequest({ workloadId: 'child', dependencies: ['parent'] })).workloadId;
    authority.validate(child);
    authority.queue(child);
    const recommendation = authority.recommendPlacement(child);
    expect(recommendation.action).toBe('defer');
    expect(recommendation.reasons.join(' ')).toContain('Waiting for completed dependencies');
    expect(authority.getWorkload(child).assignedResources).toEqual([]);
  });

  it('balances queued workloads by governed priority without scheduling them', () => {
    const authority = makeAuthority(new Map([
      ['high', [{ resourceId: 'resource-high', score: 0.9, explanation: [] }]],
      ['low', [{ resourceId: 'resource-low', score: 0.8, explanation: [] }]],
    ]));
    for (const [workloadId, priority] of [['low', 10], ['high', 90]] as const) {
      authority.createWorkload(makeRequest({ workloadId, priority }));
      authority.validate(workloadId);
      authority.queue(workloadId);
    }
    const balanced = authority.getBalanceRecommendations();
    expect(balanced.map((item) => item.workloadId)).toEqual(['high', 'low']);
    expect(balanced.every((item) => item.placement.action === 'place-now')).toBe(true);
    expect(authority.getWorkload('high').state).toBe('queued');
  });

  it('updates historical success rate and makes terminal forecast certain', () => {
    const authority = makeAuthority();
    const id = assignAndStart(authority);
    authority.complete(id);
    const profile = authority.getWorkload(id);
    expect(profile.historicalPerformance).toMatchObject({ completedRuns: 1, successRate: 1 });
    const forecast = authority.getForecast(id);
    expect(forecast.estimatedRemainingMs).toBe(0);
    expect(forecast.confidence).toBe(1);
  });
});
