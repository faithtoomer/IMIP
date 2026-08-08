import { describe, expect, it } from 'vitest';
import { InstitutionalSecurityPostureModel } from '../src/posture.js';
import type { SecretRecord, SecurityAuditRecord, TrustRecord } from '../src/types.js';

function trustRecord(overrides: Partial<TrustRecord> = {}): TrustRecord {
  return {
    componentId: 'c1',
    componentType: 'authority',
    identity: 'x',
    trustLevel: 'basic',
    certificationStatus: 'uncertified',
    signatureStatus: 'unsigned',
    riskClassification: 'low',
    lastValidation: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('InstitutionalSecurityPostureModel (§22 — the ISPM)', () => {
  it('a clean platform (no findings) scores 100', () => {
    const ispm = new InstitutionalSecurityPostureModel(() => [], () => [], () => []);
    const posture = ispm.evaluate();
    expect(posture.score).toBe(100);
    expect(posture.findings).toHaveLength(0);
  });

  it('a revoked component produces a critical trust finding and lowers the score', () => {
    const ispm = new InstitutionalSecurityPostureModel(
      () => [trustRecord({ certificationStatus: 'revoked' })],
      () => [],
      () => [],
    );
    const posture = ispm.evaluate();
    expect(posture.findings.some((f) => f.severity === 'critical' && f.category === 'trust')).toBe(true);
    expect(posture.score).toBeLessThan(100);
  });

  it('credentialsRequiringRotation() finds secrets older than the threshold', () => {
    const old: SecretRecord = {
      secretId: 's1',
      category: 'api-key',
      createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
      lastRotatedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
      accessCount: 0,
    };
    const fresh: SecretRecord = {
      secretId: 's2',
      category: 'api-key',
      createdAt: new Date().toISOString(),
      lastRotatedAt: new Date().toISOString(),
      accessCount: 0,
    };
    const ispm = new InstitutionalSecurityPostureModel(() => [], () => [old, fresh], () => []);
    const stale = ispm.credentialsRequiringRotation();
    expect(stale.map((r) => r.secretId)).toEqual(['s1']);
  });

  it('lowestTrustComponents() surfaces untrusted and revoked components', () => {
    const ispm = new InstitutionalSecurityPostureModel(
      () => [trustRecord({ componentId: 'a', trustLevel: 'certified' }), trustRecord({ componentId: 'b', trustLevel: 'untrusted' })],
      () => [],
      () => [],
    );
    expect(ispm.lowestTrustComponents().map((r) => r.componentId)).toEqual(['b']);
  });

  it('whyDenied() filters audit records for a component\'s denials', () => {
    const records: SecurityAuditRecord[] = [
      { auditId: 'a', timestamp: '', componentId: 'c1', operation: 'x', decision: 'denied', reason: 'no grant' },
      { auditId: 'b', timestamp: '', componentId: 'c1', operation: 'x', decision: 'approved' },
    ];
    const ispm = new InstitutionalSecurityPostureModel(() => [], () => [], () => records);
    expect(ispm.whyDenied('c1')).toHaveLength(1);
    expect(ispm.whyDenied('c1')[0].reason).toBe('no grant');
  });

  it('many recent denials produce a critical audit finding', () => {
    const records: SecurityAuditRecord[] = Array.from({ length: 6 }, (_, i) => ({
      auditId: `a${i}`,
      timestamp: '',
      componentId: 'c1',
      operation: 'x',
      decision: 'denied' as const,
    }));
    const ispm = new InstitutionalSecurityPostureModel(() => [], () => [], () => records);
    const posture = ispm.evaluate();
    expect(posture.findings.some((f) => f.category === 'audit' && f.severity === 'critical')).toBe(true);
  });
});
