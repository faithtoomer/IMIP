import { describe, expect, it } from 'vitest';
import { makeAuthority, makeRequest } from './testHelpers.js';

describe('IRAA Law-5 explainability', () => {
  it('answers competitors, contested resource, policies, winning rationale, non-winner reasons, constraints, and fairness', () => {
    const authority = makeAuthority({ providers: { power: { getPowerConstraint: (_resource, request) => request.requestId === 'denied' ? { permitted: false, reason: 'power budget exhausted' } : { permitted: true } } } });
    const decision = authority.arbitrate([makeRequest({ requestId: 'winner', priority: 3 }), makeRequest({ requestId: 'deferred', owner: 'other', priority: 1 }), makeRequest({ requestId: 'denied', owner: 'bad', priority: 9 })]);
    const explanation = authority.explain(decision.arbitrationId);
    expect(explanation).toMatchObject({ competingRequests: ['deferred', 'denied', 'winner'], contestedResource: 'gpu-001', policies: expect.arrayContaining(['fair-share', 'future-ai-recommendations-advisory-only']), decisionRationale: expect.stringContaining('winner'), fairnessEvaluation: expect.stringContaining('denied') });
    expect(explanation.scores).toHaveLength(3); expect(explanation.constraints.find((entry) => entry.requestId === 'denied')?.violations).toContain('power budget exhausted');
  });
});
