import type { CertificationDecision, CertificationEvidence, CertificationRecord } from './types.js';

export interface CertificationExplanation {
  hardware: { hardwareUuid: string; deviceType: string };
  certification: { certificationId: string; level: string; status: string; stage: string };
  evidenceEvaluated: Array<{ evidenceId: string; type: string; source: string; observedAt: string }>;
  policiesApplied: string[];
  testsPassed: string[];
  requirementsFailed: string[];
  decisionRationale: string;
  historicalCertifications: string[];
  revocationHistory: Array<{ revokedAt: string; reason: string; evidenceRefs: string[] }>;
}

/**
 * Law 4: every explanation explicitly answers what hardware, which evidence,
 * which tests passed, which requirements failed, and why it was granted/denied.
 */
export function explainCertification(
  record: CertificationRecord,
  evidence: readonly CertificationEvidence[],
  history: readonly CertificationRecord[],
): CertificationExplanation {
  const decision: CertificationDecision | undefined = record.decision;
  const passed = decision?.testsPassed ?? [];
  const failed = decision?.requirementsFailed ?? [];
  return {
    hardware: { hardwareUuid: record.hardwareUuid, deviceType: record.deviceType },
    certification: {
      certificationId: record.certificationId,
      level: record.level,
      status: record.status,
      stage: record.stage,
    },
    evidenceEvaluated: evidence.map((observation) => ({
      evidenceId: observation.evidenceId,
      type: observation.type,
      source: observation.source,
      observedAt: observation.observedAt,
    })).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
    policiesApplied: [...record.policiesApplied],
    testsPassed: [...passed],
    requirementsFailed: [...failed],
    decisionRationale: decision?.rationale
      ?? 'No certification evaluation has been completed; no certification has been granted or denied.',
    historicalCertifications: history
      .filter((candidate) => candidate.certificationId !== record.certificationId)
      .map((candidate) => candidate.certificationId),
    revocationHistory: record.revocationHistory.map((entry) => ({
      revokedAt: entry.revokedAt,
      reason: entry.reason,
      evidenceRefs: [...entry.evidenceRefs],
    })),
  };
}
