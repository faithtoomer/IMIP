import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { detectContention, contestedResourceKey } from './contention.js';
import { ArbitrationValidationError } from './errors.js';
import { ARBITRATION_EVENTS, ArbitrationEventBus, type ArbitrationEventName } from './events.js';
import { explainArbitration } from './explainability.js';
import { InstitutionalArbitrationKnowledgeBase } from './iakb.js';
import { assertArbitrationLifecycleTransition } from './lifecycle.js';
import { PolicyRegistry } from './policies.js';
import { withDefaultArbitrationProviders } from './providers.js';
import { ArbitrationRegistry } from './registry.js';
import { scoreArbitrationRequests, selectWinningScore } from './scoring.js';
import { StarvationDetector, type StarvationOptions } from './starvation.js';
import type { ArbitrationDecision, ArbitrationExplanation, ArbitrationLifecycleRecord, ArbitrationProviders, ArbitrationRecord, ArbitrationRequest, Policy, RequestConstraintEvaluation } from './types.js';

export interface ArbitrationAuthorityOptions extends StarvationOptions { providers?: ArbitrationProviders; eventBus?: InstitutionalEventBus; now?: () => string; policies?: Policy[]; }
/** IRAA resolves a competing-request order only. A caller separately submits the winning request to IRIA. */
export class ArbitrationAuthority {
  readonly registry = new ArbitrationRegistry();
  readonly policies: PolicyRegistry;
  readonly starvation: StarvationDetector;
  readonly iakb = new InstitutionalArbitrationKnowledgeBase();
  readonly events: ArbitrationEventBus;
  private readonly providers: ReturnType<typeof withDefaultArbitrationProviders>;
  private readonly nowFn: () => string;
  private lifecycle: ArbitrationLifecycleRecord[] = [];
  constructor(options: ArbitrationAuthorityOptions = {}) { this.providers = withDefaultArbitrationProviders(options.providers); this.policies = new PolicyRegistry(options.policies); this.starvation = new StarvationDetector(options); this.events = new ArbitrationEventBus(options.eventBus); this.nowFn = options.now ?? (() => new Date().toISOString()); }
  /** Uses injected pending requests if no explicit allocation-shaped request set is supplied. */
  arbitrate(requests: ArbitrationRequest[] = this.providers.competingRequests.getCompetingRequests()): ArbitrationDecision {
    const groups = detectContention(requests);
    if (groups.length !== 1) {
      const error = new ArbitrationValidationError('A single arbitration run must target exactly one contested resource group; use arbitrateAllPending() for multiple groups.');
      this.events.publish(ARBITRATION_EVENTS.ArbitrationFailed, { contestedResource: groups[0]?.resourceKey ?? 'unresolved', reason: error.message });
      throw error;
    }
    return this.arbitrateGroup(groups[0]!.resourceKey, groups[0]!.requests, groups[0]!.isContended);
  }
  arbitrateAllPending(requests: ArbitrationRequest[] = this.providers.competingRequests.getCompetingRequests()): ArbitrationDecision[] { return detectContention(requests).map((group) => this.arbitrateGroup(group.resourceKey, group.requests, group.isContended)); }
  getDecision(arbitrationId: string): ArbitrationDecision | undefined { return this.registry.get(arbitrationId)?.decision; }
  getLifecycle(arbitrationId: string): ArbitrationLifecycleRecord[] { return this.lifecycle.filter((record) => record.arbitrationId === arbitrationId); }
  explain(arbitrationId: string): ArbitrationExplanation { const explanation = this.registry.require(arbitrationId).explainabilityRecord; if (!explanation) throw new ArbitrationValidationError(`Arbitration ${arbitrationId} has no completed explanation.`); return explanation; }
  queryKnowledge(query = {}) { return this.iakb.query(query); }
  subscribe(event: ArbitrationEventName, handler: (payload: unknown) => void): () => void { return this.events.subscribe(event, handler); }
  private arbitrateGroup(resourceKey: string, requests: ArbitrationRequest[], isContended: boolean): ArbitrationDecision {
    const now = this.now(); const sorted = [...requests].sort((a, b) => a.requestId.localeCompare(b.requestId));
    const arbitrationId = deterministicUuid(`${resourceKey}|${now}|${canonicalRequests(sorted)}`);
    try {
      this.validateRequests(sorted); this.starvation.observe(sorted, now);
      this.registry.upsert({ arbitrationId, timestamp: now, contestedResource: resourceKey, competingRequests: sorted, stage: 'request-received', deferredRequests: [], policiesApplied: [] });
      this.recordTransition(arbitrationId, undefined, 'request-received', 'Allocation-shaped competing requests received by IRAA.');
      this.events.publish(ARBITRATION_EVENTS.ArbitrationStarted, { arbitrationId, contestedResource: resourceKey, requests: sorted });
      this.transition(arbitrationId, 'contention-detected', 'Requests grouped by contested resource identity.');
      if (isContended) this.events.publish(ARBITRATION_EVENTS.ResourceContentionDetected, { arbitrationId, contestedResource: resourceKey, requestIds: sorted.map((request) => request.requestId) });
      this.transition(arbitrationId, 'policy-evaluation', 'All registered data-driven policies evaluated.');
      const constraints = this.evaluateConstraints(sorted); const context = { resourceKey, requests: sorted, constraints, firstSeenAt: this.starvation.firstSeenMap(sorted, now), historicalGrantsByOwner: this.starvation.grantsForOwners(resourceKey, sorted), now, starvationThresholdMs: this.starvation.starvationThresholdMs };
      const policyResults = this.policies.evaluate(context);
      this.transition(arbitrationId, 'constraint-evaluation', 'Availability, health, thermal, power, and runtime provider evidence evaluated.');
      const scores = scoreArbitrationRequests(sorted, constraints, policyResults, context.firstSeenAt);
      const winner = selectWinningScore(scores);
      const deferredRequests = scores.filter((score) => score.requestId !== winner?.requestId).map((score) => {
        const remainsEligible = score.constraint.eligible && score.policyResults.every((result) => result.eligible);
        return { requestId: score.requestId, disposition: remainsEligible ? 'deferred' as const : 'denied' as const, reason: remainsEligible ? 'A higher deterministic arbitration score prevailed; the request remains eligible for a future cycle.' : [...score.constraint.violations, ...score.policyResults.filter((result) => !result.eligible).flatMap((result) => result.rationale)].join(' ') || 'Policy eligibility prevented selection.' };
      });
      this.transition(arbitrationId, 'winner-selected', winner ? `Request ${winner.requestId} selected by aggregate policy score; lexicographic requestId breaks exact ties.` : 'No request survived provider constraints and policy eligibility.');
      const base: Omit<ArbitrationDecision, 'explanation'> = { decisionId: deterministicUuid(`${arbitrationId}|decision`), arbitrationId, timestamp: now, contestedResource: resourceKey, winningRequestId: winner?.requestId, deferredRequests, policiesApplied: this.policies.all().map((policy) => policy.name), decisionScore: winner?.total, allocationSubmitted: false };
      const explanation = explainArbitration(resourceKey, sorted, base); explanation.scores = scores; explanation.constraints = [...constraints.values()].sort((a, b) => a.requestId.localeCompare(b.requestId));
      const decision: ArbitrationDecision = { ...base, explanation };
      this.upsertDecision(arbitrationId, decision, 'decision-published', 'Binding arbitration decision published; IRAA did not submit or allocate the resource.');
      if (winner) this.events.publish(ARBITRATION_EVENTS.ResourceGranted, { arbitrationId, requestId: winner.requestId, meaning: 'Selected for separate caller submission to IRIA; no allocation occurred in IRAA.' });
      for (const deferred of deferredRequests) this.events.publish(deferred.disposition === 'denied' ? ARBITRATION_EVENTS.ResourceDenied : ARBITRATION_EVENTS.ResourceDeferred, { arbitrationId, ...deferred });
      const findings = this.starvation.detect(resourceKey, sorted, winner?.requestId, now); for (const finding of findings) this.events.publish(ARBITRATION_EVENTS.StarvationDetected, finding);
      this.events.publish(ARBITRATION_EVENTS.ArbitrationCompleted, { arbitrationId, decision });
      const grants = this.starvation.grantsForOwners(resourceKey, sorted); this.iakb.record(decision, sorted, now, grants, this.starvation.maximumWaitMs(sorted, now)); this.starvation.recordDecision(resourceKey, sorted, winner?.requestId);
      this.transition(arbitrationId, 'history-archived', 'Decision and fairness evidence archived in the IAKB.');
      return decision;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error); const existing = this.registry.get(arbitrationId);
      if (!existing) this.registry.upsert({ arbitrationId, timestamp: now, contestedResource: resourceKey, competingRequests: sorted, stage: 'request-received', deferredRequests: [], policiesApplied: [], failureReason: message }); else this.registry.upsert({ ...existing, failureReason: message });
      this.events.publish(ARBITRATION_EVENTS.ArbitrationFailed, { arbitrationId, contestedResource: resourceKey, reason: message });
      throw error;
    }
  }
  private validateRequests(requests: readonly ArbitrationRequest[]): void { if (requests.length === 0) throw new ArbitrationValidationError('At least one arbitration request is required.'); const ids = new Set<string>(); for (const request of requests) { if (!request.requestId.trim() || !request.owner.trim() || !request.requestingAuthority.trim()) throw new ArbitrationValidationError('Request id, owner, and requesting authority are required.'); if (!Number.isFinite(request.capacity) || request.capacity <= 0 || !Number.isFinite(request.priority)) throw new ArbitrationValidationError('Request capacity must be positive and priority must be finite.'); if (ids.has(request.requestId)) throw new ArbitrationValidationError(`Duplicate request id ${request.requestId}.`); ids.add(request.requestId); } }
  private evaluateConstraints(requests: readonly ArbitrationRequest[]): Map<string, RequestConstraintEvaluation> { return new Map(requests.map((request) => { const availability = this.providers.availability.getAvailability(request.resourceId, request); const health = this.providers.health.getHealth(request.resourceId, request); const thermal = this.providers.thermal.getThermalConstraint(request.resourceId, request); const power = this.providers.power.getPowerConstraint(request.resourceId, request); const runtime = this.providers.runtime.getRuntimeState(request); const violations = [!availability.available ? availability.reason ?? 'Resource is unavailable.' : undefined, availability.availableCapacity !== undefined && availability.availableCapacity < request.capacity ? `Available capacity ${availability.availableCapacity} is below requested capacity ${request.capacity}.` : undefined, health.status === 'faulted' ? health.reason ?? 'Resource health is faulted.' : undefined, !thermal.permitted ? thermal.reason ?? 'Thermal constraint rejects request.' : undefined, !power.permitted ? power.reason ?? 'Power constraint rejects request.' : undefined, !runtime.permitted ? runtime.reason ?? 'Runtime state rejects request.' : undefined].filter((value): value is string => value !== undefined); return [request.requestId, { requestId: request.requestId, availability, health, thermal, power, runtime, eligible: violations.length === 0, violations }]; })); }
  private transition(arbitrationId: string, to: ArbitrationRecord['stage'], reason: string): void { const current = this.registry.require(arbitrationId); assertArbitrationLifecycleTransition(current.stage, to); this.registry.upsert({ ...current, stage: to }); this.recordTransition(arbitrationId, current.stage, to, reason); }
  private upsertDecision(arbitrationId: string, decision: ArbitrationDecision, stage: ArbitrationRecord['stage'], reason: string): void { const current = this.registry.require(arbitrationId); assertArbitrationLifecycleTransition(current.stage, stage); this.registry.upsert({ ...current, stage, winningRequestId: decision.winningRequestId, deferredRequests: decision.deferredRequests, policiesApplied: decision.policiesApplied, decisionScore: decision.decisionScore, explainabilityRecord: decision.explanation, decision }); this.recordTransition(arbitrationId, current.stage, stage, reason); }
  private recordTransition(arbitrationId: string, from: ArbitrationLifecycleRecord['from'], to: ArbitrationLifecycleRecord['to'], reason: string): void { this.lifecycle.push(Object.freeze({ arbitrationId, from, to, at: this.now(), reason })); }
  private now(): string { return this.nowFn(); }
}
function canonicalRequests(requests: readonly ArbitrationRequest[]): string { return JSON.stringify([...requests].sort((a, b) => a.requestId.localeCompare(b.requestId))); }
/** Deterministic UUID-shaped ID derived only from arbitration inputs and injected clock. */
function deterministicUuid(input: string): string { const h = (seed: number) => { let value = seed; for (let index = 0; index < input.length; index += 1) value = Math.imul(value ^ input.charCodeAt(index), 0x01000193) >>> 0; return value.toString(16).padStart(8, '0'); }; const a = h(0x811c9dc5), b = h(0x811c9dc6), c = h(0x811c9dc7), d = h(0x811c9dc8); return `${a}-${b.slice(0, 4)}-5${b.slice(5, 8)}-8${c.slice(1, 4)}-${c.slice(4)}${d}`; }
