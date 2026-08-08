import { describe, expect, it } from 'vitest';
import { EmergencyOverridePolicy, ExclusiveAccessPolicy, FairSharePolicy, FirstComeFirstServedPolicy, FutureAiRecommendationsAdvisoryOnlyPolicy, PolicyRegistry, PriorityBasedPolicy, ReservationFirstPolicy, SharedAllocationPolicy } from '../src/policies.js';
import type { PolicyContext } from '../src/types.js';
import { makeRequest } from './testHelpers.js';

const early = makeRequest({ requestId: 'early', owner: 'owner-a', priority: 1, mode: 'exclusive', reservationId: 'res-1', emergency: true, aiRecommendation: 'prefer' });
const late = makeRequest({ requestId: 'late', owner: 'owner-b', priority: 5, mode: 'shared', capacity: 2 });
const context: PolicyContext = { resourceKey: 'gpu-001', requests: [early, late], constraints: new Map([
  ['early', { requestId: 'early', availability: { available: true, existingExclusiveAllocation: true }, health: { status: 'healthy' }, thermal: { permitted: true }, power: { permitted: true }, runtime: { permitted: true }, eligible: true, violations: [] }],
  ['late', { requestId: 'late', availability: { available: true, availableCapacity: 1 }, health: { status: 'healthy' }, thermal: { permitted: true }, power: { permitted: true }, runtime: { permitted: true }, eligible: true, violations: [] }],
]), firstSeenAt: new Map([['early', '2026-08-08T20:00:00.000Z'], ['late', '2026-08-08T20:00:09.000Z']]), historicalGrantsByOwner: new Map([['owner-a', 4], ['owner-b', 0]]), now: '2026-08-08T20:00:10.000Z', starvationThresholdMs: 5_000 };

describe('IRAA pluggable named policies', () => {
  it('implements every named policy as independently evaluable data-driven policy logic', () => {
    const fcfs = new FirstComeFirstServedPolicy().evaluate(context); expect(fcfs[0]!.scoreAdjustment).toBeGreaterThan(fcfs[1]!.scoreAdjustment);
    const priority = new PriorityBasedPolicy().evaluate(context); expect(priority[1]!.scoreAdjustment).toBeGreaterThan(priority[0]!.scoreAdjustment);
    const fairness = new FairSharePolicy().evaluate(context); expect(fairness[0]!.scoreAdjustment).toBeGreaterThan(99_000);
    const reservation = new ReservationFirstPolicy().evaluate(context); expect(reservation[0]!.scoreAdjustment).toBeGreaterThan(0);
    const exclusive = new ExclusiveAccessPolicy().evaluate(context); expect(exclusive[0]!.eligible).toBe(false);
    const shared = new SharedAllocationPolicy().evaluate(context); expect(shared[1]!.eligible).toBe(false);
    const emergency = new EmergencyOverridePolicy().evaluate(context); expect(emergency[0]!.scoreAdjustment).toBeGreaterThan(999_999);
    const ai = new FutureAiRecommendationsAdvisoryOnlyPolicy().evaluate(context); expect(ai[0]).toMatchObject({ scoreAdjustment: 0, advisoryOnly: true });
  });
  it('allows policy registration and replacement without changing arbitration orchestration', () => {
    const registry = new PolicyRegistry([]); registry.register(new PriorityBasedPolicy());
    expect(registry.all().map((policy) => policy.name)).toEqual(['priority-based']);
    expect(registry.remove('priority-based')).toBe(true);
  });
});
