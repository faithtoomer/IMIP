import { EvidenceImmutabilityError } from './errors.js';
import type { CertificationEvidence, CertificationEvidenceAttachment } from './types.js';

/**
 * Append-only storage for evidence attached to a certification evaluation. It
 * snapshots and deeply freezes each observation; new observation IDs can be added,
 * but an existing attached observation can never be replaced or mutated.
 */
export class CertificationEvidenceStore {
  private readonly attachments = new Map<string, readonly CertificationEvidenceAttachment[]>();

  attach(
    certificationId: string,
    evidence: readonly CertificationEvidence[],
    attachedAt: string,
  ): readonly CertificationEvidenceAttachment[] {
    const existing = this.attachments.get(certificationId) ?? [];
    const existingIds = new Set(existing.map((attachment) => attachment.evidence.evidenceId));
    const incomingIds = new Set<string>();
    for (const observation of evidence) {
      if (!observation.evidenceId.trim()) {
        throw new EvidenceImmutabilityError('Certification evidence requires a stable evidenceId.');
      }
      if (existingIds.has(observation.evidenceId) || incomingIds.has(observation.evidenceId)) {
        throw new EvidenceImmutabilityError(`Evidence ${observation.evidenceId} is already attached; attach a new observation instead.`);
      }
      incomingIds.add(observation.evidenceId);
    }
    const appended = evidence.map((observation) => deepFreeze({
      certificationId,
      evidence: cloneEvidence(observation),
      attachedAt,
    }));
    const all = Object.freeze([...existing, ...appended]);
    this.attachments.set(certificationId, all);
    return all;
  }

  forCertification(certificationId: string): readonly CertificationEvidenceAttachment[] {
    return this.attachments.get(certificationId) ?? Object.freeze([]);
  }

  evidenceFor(certificationId: string): readonly CertificationEvidence[] {
    return Object.freeze(this.forCertification(certificationId).map((attachment) => attachment.evidence));
  }

  referencesFor(certificationId: string): string[] {
    return this.forCertification(certificationId).map((attachment) => attachment.evidence.evidenceId);
  }
}

function cloneEvidence(evidence: CertificationEvidence): CertificationEvidence {
  return {
    ...evidence,
    metrics: { ...evidence.metrics },
    references: evidence.references ? [...evidence.references] : undefined,
    details: evidence.details ? cloneValue(evidence.details) as Record<string, unknown> : undefined,
  };
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cloneValue(item)])) as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return value;
}
