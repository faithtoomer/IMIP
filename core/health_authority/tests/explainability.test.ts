import { describe, expect, it } from 'vitest';
import { HealthAuditTrail, explainHealth } from '../src/explainability.js';
import { makeAuthority, makeObservation } from './testHelpers.js';

describe('IHIA health explainability', () => {
  it('records immutable assessment evidence', () => {
    const trail = new HealthAuditTrail();
    const record = trail.record({ timestamp: '2026-08-08T12:00:00.000Z', profileId: 'p-1', registryKey: 'k', kind: 'assessed', reason: 'test', evidence: ['source value'] });
    expect(Object.isFrozen(record)).toBe(true);
    expect(trail.forProfile('p-1')).toHaveLength(1);
  });

  it('answers what changed, why, evidence, trend, forecast, and recommendation without claiming raw metric ownership', () => {
    const authority = makeAuthority();
    authority.assess(makeObservation({ observedAt: '2026-08-08T12:00:00.000Z', metrics: { overallScore: 90 } }));
    authority.assess(makeObservation({ observedAt: '2026-08-08T12:05:00.000Z', metrics: { overallScore: 60 }, evidence: ['Published source reported declining reliability.'] }));
    const answer = authority.explain('hardware', 'gpu-001', 'Hardware health adapter');
    expect(answer.whatChanged).toContain('90.0 → 60.0');
    expect(answer.why).toContain('configured weights');
    expect(answer.why).toContain('did not redetect');
    expect(answer.supportingEvidence).toEqual(['Published source reported declining reliability.']);
    expect(answer.historicalTrend).toContain('degrading');
    expect(answer.forecast).toContain('Advisory failure prediction');
    expect(answer.recommendedAction).toContain('preventative maintenance');
    expect(answer.evidence).toHaveLength(2);
  });

  it('renders a direct profile/audit/forecast explanation deterministically', () => {
    const authority = makeAuthority();
    const profile = authority.assess(makeObservation());
    const forecast = authority.getForecast('hardware', 'gpu-001', 'Hardware health adapter');
    const answer = explainHealth(profile, authority.audit.forProfile(profile.profileId), forecast);
    expect(answer.profileId).toBe(profile.profileId);
    expect(answer.whatChanged).toContain('Initial');
  });
});
