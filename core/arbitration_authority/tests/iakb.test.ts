import { describe, expect, it } from 'vitest';
import { makeAuthority, makeClock, makeRequest } from './testHelpers.js';

describe('Institutional Arbitration Knowledge Base', () => {
  it('records outcomes, fairness, policies, and recurring resource contention patterns queryably', () => {
    const clock = makeClock(); const authority = makeAuthority({ now: clock.now });
    authority.arbitrate([makeRequest({ requestId: 'a1' }), makeRequest({ requestId: 'b1', owner: 'owner-b', priority: 2 })]);
    clock.advance(1); authority.arbitrate([makeRequest({ requestId: 'a2' }), makeRequest({ requestId: 'b2', owner: 'owner-b', priority: 2 })]);
    expect(authority.queryKnowledge({ resourceId: 'gpu-001' })).toHaveLength(2);
    expect(authority.queryKnowledge({ policy: 'priority-based' })).toHaveLength(2);
    expect(authority.iakb.recurringBottlenecks()).toEqual([{ resourceId: 'gpu-001', occurrences: 2 }]);
  });
});
