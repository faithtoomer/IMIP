import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CERTIFICATION_LEVEL_REQUIREMENTS,
  PolicyRegistry,
  ThresholdCertificationPolicy,
  aggregateEvidenceMetrics,
} from '../src/policies.js';
import type { CertificationEvidence, CertificationLevel, CertificationPolicyContext, CertificationRecord } from '../src/types.js';
import { fullEvidence, makeEvidence } from './testHelpers.js';

function context(level: CertificationLevel, evidence: CertificationEvidence[]): CertificationPolicyContext {
  const certification: CertificationRecord = {
    certificationId: 'cert-1',
    hardwareUuid: 'hardware-1',
    deviceType: 'gpu',
    level,
    status: 'pending',
    stage: 'discovered',
    createdAt: '2026-08-08T20:00:00.000Z',
    updatedAt: '2026-08-08T20:00:00.000Z',
    evidenceRefs: evidence.map((entry) => entry.evidenceId),
    auditorVersion: 'v1',
    notes: [],
    policiesApplied: [],
    revocationHistory: [],
  };
  return { certification, evidence, aggregateMetrics: aggregateEvidenceMetrics(evidence) };
}

describe('IHCA pluggable certification-level policies', () => {
  it('evaluates every required certification level through configurable policy data', () => {
    for (const level of Object.keys(DEFAULT_CERTIFICATION_LEVEL_REQUIREMENTS) as CertificationLevel[]) {
      const policy = new ThresholdCertificationPolicy(level, DEFAULT_CERTIFICATION_LEVEL_REQUIREMENTS[level]);
      const result = policy.evaluate(context(level, fullEvidence(100, level)));
      expect(result).toMatchObject({ level, eligible: true });
      expect(result.requirements.every((requirement) => requirement.passed)).toBe(true);
    }
  });

  it('denies when an individual configured requirement lacks qualifying evidence', () => {
    const policy = new ThresholdCertificationPolicy('production', DEFAULT_CERTIFICATION_LEVEL_REQUIREMENTS.production);
    const evidence = fullEvidence(100, 'pass').filter((entry) => entry.type !== 'thermal')
      .concat([makeEvidence('thermal', 10, 'failing')]);
    const result = policy.evaluate(context('production', evidence));
    expect(result.eligible).toBe(false);
    expect(result.requirements.find((requirement) => requirement.requirement.startsWith('thermalStabilityScore'))).toMatchObject({ passed: false, observed: 10, required: 75 });
  });

  it('allows policy registration and replacement without changing certification orchestration', () => {
    const registry = new PolicyRegistry([]);
    const policy = new ThresholdCertificationPolicy('experimental', {
      minimumEvidence: 1,
      metricThresholds: { stabilityScore: 1 },
    }, 'custom-experimental');
    registry.register(policy);
    expect(registry.require('experimental').name).toBe('custom-experimental');
    expect(registry.remove('experimental')).toBe(true);
  });
});
