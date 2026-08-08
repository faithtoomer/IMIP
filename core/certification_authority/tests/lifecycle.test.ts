import { describe, expect, it } from 'vitest';
import { CertificationLifecycleError, CertificationValidationError } from '../src/errors.js';
import { CERTIFICATION_LIFECYCLE, assertCertificationLifecycleTransition } from '../src/lifecycle.js';
import { fullEvidence, makeAuthority, makeRequest, providersFromEvidence } from './testHelpers.js';

describe('IHCA seven-stage lifecycle', () => {
  it('records every guarded lifecycle transition from discovery through recertification and revocation', () => {
    let evidence = fullEvidence(100, '1');
    const authority = makeAuthority({ providers: providersFromEvidence(() => evidence) });
    const started = authority.start(makeRequest());
    authority.evaluate(started.certificationId);
    authority.qualify(started.certificationId);
    authority.certify(started.certificationId);
    authority.approveProduction(started.certificationId);
    evidence = fullEvidence(100, '2');
    authority.recertify(started.certificationId);
    authority.revoke(started.certificationId, 'operational evidence degraded after recertification');
    expect(authority.getLifecycle(started.certificationId).map((record) => record.to)).toEqual(CERTIFICATION_LIFECYCLE);
    expect(authority.getCertification(started.certificationId).stage).toBe('revoked');
  });

  it('supports revocation from certified, production-approved, and recertified states', () => {
    const certified = makeAuthority();
    const first = certified.start(makeRequest({ level: 'qualified' }));
    certified.evaluate(first.certificationId);
    certified.qualify(first.certificationId);
    certified.certify(first.certificationId);
    expect(certified.revoke(first.certificationId, 'faulted health evidence').stage).toBe('revoked');

    const production = makeAuthority();
    const second = production.start(makeRequest());
    production.evaluate(second.certificationId);
    production.qualify(second.certificationId);
    production.certify(second.certificationId);
    production.approveProduction(second.certificationId);
    expect(production.revoke(second.certificationId, 'thermal instability').stage).toBe('revoked');

    let evidence = fullEvidence(100, 'first');
    const recertified = makeAuthority({ providers: providersFromEvidence(() => evidence) });
    const third = recertified.start(makeRequest());
    recertified.evaluate(third.certificationId);
    recertified.qualify(third.certificationId);
    recertified.certify(third.certificationId);
    recertified.approveProduction(third.certificationId);
    evidence = fullEvidence(100, 'second');
    recertified.recertify(third.certificationId);
    expect(recertified.revoke(third.certificationId, 'runtime failure').stage).toBe('revoked');
  });

  it('rejects skipped, reversed, and unearned production lifecycle transitions', () => {
    expect(() => assertCertificationLifecycleTransition(undefined, 'certified')).toThrow(CertificationLifecycleError);
    expect(() => assertCertificationLifecycleTransition('revoked', 'discovered')).toThrow(CertificationLifecycleError);
    const authority = makeAuthority();
    const started = authority.start(makeRequest({ level: 'experimental' }));
    authority.evaluate(started.certificationId);
    authority.qualify(started.certificationId);
    authority.certify(started.certificationId);
    expect(() => authority.approveProduction(started.certificationId)).toThrow(CertificationValidationError);
  });
});
