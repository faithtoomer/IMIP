import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { CertificationValidationError } from './errors.js';
import { CertificationEvidenceStore } from './evidence.js';
import { CERTIFICATION_EVENTS, CertificationEventBus, type CertificationEventName } from './events.js';
import { explainCertification, type CertificationExplanation } from './explainability.js';
import { assertCertificationLifecycleTransition } from './lifecycle.js';
import { aggregateEvidenceMetrics, PolicyRegistry } from './policies.js';
import { collectCertificationEvidence, withDefaultCertificationProviders } from './providers.js';
import { CertificationRegistry } from './registry.js';
import { InstitutionalHardwareTrustModel } from './trust.js';
import type {
  CertificationDecision,
  CertificationEvidence,
  CertificationLifecycleRecord,
  CertificationPolicy,
  CertificationProviders,
  CertificationRecord,
  CertificationRequest,
  HardwareTrustScore,
} from './types.js';

export interface CertificationAuthorityOptions {
  providers?: CertificationProviders;
  eventBus?: InstitutionalEventBus;
  now?: () => string;
  policies?: CertificationPolicy[];
}

/**
 * IHCA is IMIP's sole certification decision authority. It consumes immutable
 * provider evidence and owns only certification records, policy decisions,
 * lifecycle/audit evidence, explainability, and the IHTM composed read model.
 */
export class CertificationAuthority {
  readonly registry = new CertificationRegistry();
  readonly evidence = new CertificationEvidenceStore();
  readonly policies: PolicyRegistry;
  readonly trust = new InstitutionalHardwareTrustModel();
  readonly events: CertificationEventBus;

  private readonly providers: ReturnType<typeof withDefaultCertificationProviders>;
  private readonly nowFn: () => string;
  private readonly lifecycle: CertificationLifecycleRecord[] = [];

  constructor(options: CertificationAuthorityOptions = {}) {
    this.providers = withDefaultCertificationProviders(options.providers);
    this.policies = new PolicyRegistry(options.policies);
    this.events = new CertificationEventBus(options.eventBus);
    this.nowFn = options.now ?? (() => new Date().toISOString());
  }

  /** Opens an IHCA-owned decision record; it neither discovers nor changes hardware. */
  start(request: CertificationRequest): CertificationRecord {
    this.validateRequest(request);
    const now = this.now();
    const certificationId = deterministicUuid(`certification|${request.hardwareUuid}|${request.deviceType}|${request.level}|${request.auditorVersion}|${now}|${canonical(request.notes ?? [])}`);
    if (this.registry.get(certificationId)) {
      throw new CertificationValidationError(`Certification ${certificationId} already exists for this deterministic request.`);
    }
    const record: CertificationRecord = {
      certificationId,
      hardwareUuid: request.hardwareUuid,
      deviceType: request.deviceType,
      level: request.level,
      status: 'pending',
      stage: 'discovered',
      createdAt: now,
      updatedAt: now,
      expirationDate: request.expirationDate,
      recertificationIntervalDays: request.recertificationIntervalDays,
      evidenceRefs: [],
      auditorVersion: request.auditorVersion,
      notes: [...(request.notes ?? [])],
      policiesApplied: [],
      revocationHistory: [],
    };
    this.registry.upsert(record);
    this.recordTransition(certificationId, undefined, 'discovered', 'Certification request recorded; source hardware state remains external.');
    const started = this.registry.require(certificationId);
    this.events.publish(CERTIFICATION_EVENTS.CertificationStarted, { certification: started });
    return started;
  }

  /**
   * Collects provider evidence once, attaches frozen observation snapshots, and
   * deterministically evaluates only the policy configured for the requested level.
   */
  evaluate(certificationId: string): CertificationDecision {
    const current = this.registry.require(certificationId);
    this.assertTransition(current, 'evaluated');
    const evaluated = this.evaluateEvidence(current, 'initial certification evaluation');
    this.registry.upsert({
      ...current,
      stage: 'evaluated',
      status: evaluated.decision.passed ? 'qualified' : 'denied',
      updatedAt: evaluated.at,
      evidenceRefs: evaluated.evidenceRefs,
      policiesApplied: evaluated.decision.policyResults.map((result) => result.policyName),
      decision: evaluated.decision,
    });
    this.recordTransition(certificationId, current.stage, 'evaluated', 'Provider evidence attached immutably and configured certification policy evaluated.');
    this.events.publish(
      evaluated.decision.passed ? CERTIFICATION_EVENTS.CertificationPassed : CERTIFICATION_EVENTS.CertificationFailed,
      { certification: this.registry.require(certificationId), decision: evaluated.decision },
    );
    return evaluated.decision;
  }

  qualify(certificationId: string): CertificationRecord {
    const current = this.registry.require(certificationId);
    this.assertTransition(current, 'qualified');
    if (!current.decision?.passed) {
      throw new CertificationValidationError('A passed evidence-driven certification decision is required before qualification.');
    }
    return this.transition(current, 'qualified', 'Certification evaluation passed the configured qualification policy.', { status: 'qualified' });
  }

  certify(certificationId: string): CertificationRecord {
    const current = this.registry.require(certificationId);
    this.assertTransition(current, 'certified');
    const certifiedAt = this.now();
    return this.transition(current, 'certified', 'Qualified certification formally granted by IHCA.', {
      status: 'certified',
      certificationDate: certifiedAt,
      nextRecertificationDue: recertificationDue(certifiedAt, current.recertificationIntervalDays),
    }, certifiedAt);
  }

  /**
   * Production approval is an IHCA decision record, never a resource allocation or
   * runtime deployment action. Only production-grade levels are eligible.
   */
  approveProduction(certificationId: string): CertificationRecord {
    const current = this.registry.require(certificationId);
    this.assertTransition(current, 'production-approved');
    if (!['production', 'mission-critical'].includes(current.level)) {
      throw new CertificationValidationError('Only production or mission-critical certification levels can receive production approval.');
    }
    return this.transition(current, 'production-approved', 'Production eligibility approved by IHCA; no workload or runtime action was taken.', {
      status: 'production-approved',
    });
  }

  /**
   * An externally triggered recertification consumes new observations only. A failed
   * recertification immediately records revocation rather than inventing a failure
   * lifecycle state.
   */
  recertify(certificationId: string): CertificationRecord {
    const current = this.registry.require(certificationId);
    this.assertTransition(current, 'recertified');
    const evaluation = this.evaluateEvidence(current, 'recertification evaluation');
    if (!evaluation.decision.passed) {
      this.registry.upsert({
        ...current,
        updatedAt: evaluation.at,
        evidenceRefs: evaluation.evidenceRefs,
        policiesApplied: evaluation.decision.policyResults.map((result) => result.policyName),
        decision: evaluation.decision,
      });
      this.events.publish(CERTIFICATION_EVENTS.CertificationFailed, {
        certification: this.registry.require(certificationId),
        decision: evaluation.decision,
      });
      return this.revoke(certificationId, 'Recertification evidence no longer satisfies the configured certification policy.');
    }
    return this.transition(current, 'recertified', 'New immutable evidence passed the configured recertification policy.', {
      status: 'recertified',
      evidenceRefs: evaluation.evidenceRefs,
      policiesApplied: evaluation.decision.policyResults.map((result) => result.policyName),
      decision: evaluation.decision,
      nextRecertificationDue: recertificationDue(evaluation.at, current.recertificationIntervalDays),
    }, evaluation.at);
  }

  /** Supports operational-evidence revocation from certified, production-approved, or recertified. */
  revoke(certificationId: string, reason: string): CertificationRecord {
    if (!reason.trim()) throw new CertificationValidationError('A revocation reason is required.');
    const current = this.registry.require(certificationId);
    this.assertTransition(current, 'revoked');
    const revokedAt = this.now();
    const revoked = this.transition(current, 'revoked', `Certification revoked: ${reason}`, {
      status: 'revoked',
      revocationHistory: [...current.revocationHistory, {
        revokedAt,
        reason,
        evidenceRefs: [...current.evidenceRefs],
      }],
    }, revokedAt);
    this.events.publish(CERTIFICATION_EVENTS.CertificationRevoked, { certification: revoked, reason });
    return revoked;
  }

  /**
   * Records an advisory recertification-required event only when an outside caller
   * observes that the stored due date has arrived. IHCA owns no scheduler or timer.
   */
  recordRecertificationRequired(certificationId: string, observedAt = this.now()): CertificationRecord {
    const current = this.registry.require(certificationId);
    if (!current.nextRecertificationDue || Date.parse(current.nextRecertificationDue) > Date.parse(observedAt)) {
      throw new CertificationValidationError('The certification is not yet due for recertification.');
    }
    const updated = this.update(current, { updatedAt: observedAt });
    this.events.publish(CERTIFICATION_EVENTS.RecertificationRequired, {
      certification: updated,
      nextRecertificationDue: updated.nextRecertificationDue,
    });
    return updated;
  }

  /** Records externally observed expiration; it neither schedules nor revokes by itself. */
  expire(certificationId: string, observedAt = this.now()): CertificationRecord {
    const current = this.registry.require(certificationId);
    if (!current.expirationDate || Date.parse(current.expirationDate) > Date.parse(observedAt)) {
      throw new CertificationValidationError('The certification has not reached its recorded expiration date.');
    }
    if (!['certified', 'production-approved', 'recertified'].includes(current.stage)) {
      throw new CertificationValidationError('Only a post-certified record can expire.');
    }
    const expired = this.update(current, { status: 'expired', updatedAt: observedAt });
    this.events.publish(CERTIFICATION_EVENTS.CertificationExpired, { certification: expired });
    return expired;
  }

  /** Refreshes only the IHTM read model using source-owned provider observations. */
  refreshTrust(hardwareUuid: string): HardwareTrustScore {
    this.validateHardwareUuid(hardwareUuid);
    return this.trust.update(hardwareUuid, this.collectEvidence(hardwareUuid), this.now());
  }

  getHardwareTrustScore(hardwareUuid: string): HardwareTrustScore | undefined {
    return this.trust.get(hardwareUuid);
  }

  getCertification(certificationId: string): CertificationRecord {
    return this.registry.require(certificationId);
  }

  getLifecycle(certificationId: string): CertificationLifecycleRecord[] {
    return this.lifecycle.filter((record) => record.certificationId === certificationId);
  }

  explain(certificationId: string): CertificationExplanation {
    const record = this.registry.require(certificationId);
    return explainCertification(record, this.evidence.evidenceFor(certificationId), this.registry.forHardware(record.hardwareUuid));
  }

  subscribe(event: CertificationEventName, handler: (payload: unknown) => void): () => void {
    return this.events.subscribe(event, handler);
  }

  private evaluateEvidence(
    current: CertificationRecord,
    purpose: string,
  ): { decision: CertificationDecision; evidenceRefs: string[]; at: string } {
    const at = this.now();
    const observations = this.collectEvidence(current.hardwareUuid);
    this.evidence.attach(current.certificationId, observations, at);
    const attachedEvidence = this.evidence.evidenceFor(current.certificationId);
    const trust = this.trust.update(current.hardwareUuid, attachedEvidence, at);
    const policy = this.policies.require(current.level);
    const result = policy.evaluate({
      certification: current,
      evidence: attachedEvidence,
      aggregateMetrics: aggregateEvidenceMetrics(attachedEvidence),
    });
    const requirements = result.requirements;
    const passed = result.eligible;
    const decision: CertificationDecision = {
      decisionId: deterministicUuid(`decision|${current.certificationId}|${current.level}|${at}|${canonical(attachedEvidence)}|${policy.name}`),
      certificationId: current.certificationId,
      hardwareUuid: current.hardwareUuid,
      level: current.level,
      determinedAt: at,
      passed,
      policyResults: [result],
      evidenceRefs: this.evidence.referencesFor(current.certificationId),
      testsPassed: requirements.filter((requirement) => requirement.passed).map((requirement) => requirement.requirement),
      requirementsFailed: requirements.filter((requirement) => !requirement.passed).map((requirement) => requirement.requirement),
      rationale: passed
        ? `Certification granted at the evaluation level: ${current.level}. ${purpose}; Hardware Trust Score ${trust.score} with Certification Confidence ${trust.certificationConfidence.value}.`
        : `Certification denied at the evaluation level: ${current.level}. ${purpose}; ${requirements.filter((requirement) => !requirement.passed).length} configured requirement(s) failed.`,
    };
    return { decision, evidenceRefs: this.evidence.referencesFor(current.certificationId), at };
  }

  private collectEvidence(hardwareUuid: string): CertificationEvidence[] {
    const evidence = collectCertificationEvidence(this.providers, hardwareUuid);
    const ids = new Set<string>();
    for (const observation of evidence) {
      if (!observation.evidenceId.trim() || !observation.source.trim() || Number.isNaN(Date.parse(observation.observedAt))) {
        throw new CertificationValidationError('Evidence requires evidenceId, source, and a valid observedAt timestamp.');
      }
      if (ids.has(observation.evidenceId)) throw new CertificationValidationError(`Duplicate evidenceId ${observation.evidenceId} supplied by providers.`);
      ids.add(observation.evidenceId);
      for (const [metric, score] of Object.entries(observation.metrics)) {
        if (!Number.isFinite(score) || score < 0 || score > 100) {
          throw new CertificationValidationError(`Evidence metric ${metric} must be a finite 0–100 score.`);
        }
      }
    }
    return evidence;
  }

  private validateRequest(request: CertificationRequest): void {
    this.validateHardwareUuid(request.hardwareUuid);
    if (!request.deviceType.trim() || !request.auditorVersion.trim()) {
      throw new CertificationValidationError('Device type and auditor version are required.');
    }
    if (request.expirationDate && Number.isNaN(Date.parse(request.expirationDate))) {
      throw new CertificationValidationError('Expiration date must be a valid ISO timestamp.');
    }
    if (request.recertificationIntervalDays !== undefined
      && (!Number.isFinite(request.recertificationIntervalDays) || request.recertificationIntervalDays <= 0)) {
      throw new CertificationValidationError('Recertification interval must be a positive finite day count.');
    }
  }

  private validateHardwareUuid(hardwareUuid: string): void {
    if (!hardwareUuid.trim()) throw new CertificationValidationError('Hardware UUID is required.');
  }

  private assertTransition(record: CertificationRecord, to: CertificationRecord['stage']): void {
    assertCertificationLifecycleTransition(record.stage, to);
  }

  private transition(
    current: CertificationRecord,
    to: CertificationRecord['stage'],
    reason: string,
    update: Partial<CertificationRecord>,
    at = this.now(),
  ): CertificationRecord {
    this.assertTransition(current, to);
    const transitioned = this.update(current, { ...update, stage: to, updatedAt: at });
    this.recordTransition(current.certificationId, current.stage, to, reason, at);
    return transitioned;
  }

  private update(current: CertificationRecord, update: Partial<CertificationRecord>): CertificationRecord {
    this.registry.upsert({ ...current, ...update });
    return this.registry.require(current.certificationId);
  }

  private recordTransition(
    certificationId: string,
    from: CertificationLifecycleRecord['from'],
    to: CertificationLifecycleRecord['to'],
    reason: string,
    at = this.now(),
  ): void {
    this.lifecycle.push(Object.freeze({ certificationId, from, to, at, reason }));
  }

  private now(): string {
    return this.nowFn();
  }
}

function recertificationDue(certifiedAt: string, intervalDays: number | undefined): string | undefined {
  if (intervalDays === undefined) return undefined;
  return new Date(Date.parse(certifiedAt) + intervalDays * 24 * 60 * 60 * 1000).toISOString();
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** UUID-shaped, deterministic identity derived only from supplied inputs and injected time. */
function deterministicUuid(input: string): string {
  const hash = (seed: number): string => {
    let value = seed;
    for (let index = 0; index < input.length; index += 1) {
      value = Math.imul(value ^ input.charCodeAt(index), 0x01000193) >>> 0;
    }
    return value.toString(16).padStart(8, '0');
  };
  const a = hash(0x811c9dc5);
  const b = hash(0x811c9dc6);
  const c = hash(0x811c9dc7);
  const d = hash(0x811c9dc8);
  return `${a}-${b.slice(0, 4)}-5${b.slice(5, 8)}-8${c.slice(1, 4)}-${c.slice(4)}${d}`;
}
