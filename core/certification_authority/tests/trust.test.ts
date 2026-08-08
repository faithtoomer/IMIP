import { describe, expect, it } from 'vitest';
import { fullEvidence, makeAuthority, makeRequest, providersFromEvidence } from './testHelpers.js';

describe('IHTM Hardware Trust Score and Certification Confidence', () => {
  it('aggregates all required source-evidence dimensions into a queryable read model', () => {
    const authority = makeAuthority({ providers: providersFromEvidence(() => fullEvidence(90, 'trust')) });
    const trust = authority.refreshTrust('hardware-001');
    expect(trust).toMatchObject({
      hardwareUuid: 'hardware-001',
      score: 90,
      certificationConfidence: { value: 100, evidenceCoverage: 100, sourceCount: 10, complete: true },
    });
    expect(trust.dimensions).toHaveLength(10);
    expect(trust.evidenceRefs).toHaveLength(10);
    expect(authority.getHardwareTrustScore('hardware-001')).toEqual(trust);
  });

  it('updates IHTM during a certification evaluation without granting downstream control', () => {
    const authority = makeAuthority();
    const started = authority.start(makeRequest());
    authority.evaluate(started.certificationId);
    expect(authority.getHardwareTrustScore('hardware-001')).toMatchObject({
      score: 100,
      certificationConfidence: { value: 100 },
    });
  });
});
