import { describe, expect, it } from 'vitest';
import { makeAuthority, makeRequest, evaluateAndCertify, fullEvidence, providersFromEvidence } from './testHelpers.js';

describe('IHCA Law-4 explainability', () => {
  it('answers hardware, evidence, passed tests, failed requirements, and grant-or-denial rationale', () => {
    const authority = makeAuthority();
    const started = authority.start(makeRequest());
    authority.evaluate(started.certificationId);
    const explanation = authority.explain(started.certificationId);
    expect(explanation).toMatchObject({
      hardware: { hardwareUuid: 'hardware-001', deviceType: 'gpu' },
      certification: { level: 'production', status: 'qualified', stage: 'evaluated' },
      policiesApplied: ['production-certification-policy'],
      decisionRationale: expect.stringContaining('granted'),
    });
    expect(explanation.evidenceEvaluated).toHaveLength(10);
    expect(explanation.testsPassed.length).toBeGreaterThan(0);
    expect(explanation.requirementsFailed).toEqual([]);
  });

  it('exposes denial requirements, historical certifications, and revocation history', () => {
    let evidence = fullEvidence(100, 'prior');
    const authority = makeAuthority({ providers: providersFromEvidence(() => evidence) });
    const prior = evaluateAndCertify(authority).certified;
    evidence = fullEvidence(0, 'denied');
    const denied = authority.start(makeRequest({ notes: ['denied re-evaluation'] }));
    authority.evaluate(denied.certificationId);
    const explanation = authority.explain(denied.certificationId);
    expect(explanation.requirementsFailed.length).toBeGreaterThan(0);
    expect(explanation.decisionRationale).toContain('denied');
    expect(explanation.historicalCertifications).toEqual([prior.certificationId]);
  });
});
