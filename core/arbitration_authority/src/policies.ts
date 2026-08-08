import type { ArbitrationPolicyName, Policy, PolicyContext, PolicyResult } from './types.js';

function ordered(context: PolicyContext) { return [...context.requests].sort((a, b) => a.requestId.localeCompare(b.requestId)); }
function result(policy: ArbitrationPolicyName, requestId: string, scoreAdjustment: number, rationale: string[], eligible = true, advisoryOnly?: true): PolicyResult {
  return { policy, requestId, scoreAdjustment, eligible, rationale, ...(advisoryOnly ? { advisoryOnly } : {}) };
}
function waitMs(context: PolicyContext, requestId: string): number { return Math.max(0, Date.parse(context.now) - Date.parse(context.firstSeenAt.get(requestId) ?? context.now)); }

export class FirstComeFirstServedPolicy implements Policy {
  readonly name = 'first-come-first-served' as const;
  evaluate(context: PolicyContext): PolicyResult[] {
    return ordered(context).map((request) => result(this.name, request.requestId, waitMs(context, request.requestId) / 1000, ['Earlier observed requests receive a higher FCFS score.']));
  }
}
export class PriorityBasedPolicy implements Policy {
  readonly name = 'priority-based' as const;
  evaluate(context: PolicyContext): PolicyResult[] { return ordered(context).map((request) => result(this.name, request.requestId, request.priority * 100, [`Declared priority ${request.priority} evaluated after policy and constraint context.`])); }
}
export class FairSharePolicy implements Policy {
  readonly name = 'fair-share' as const;
  evaluate(context: PolicyContext): PolicyResult[] {
    return ordered(context).map((request) => {
      const grants = context.historicalGrantsByOwner.get(request.owner) ?? 0;
      const wait = waitMs(context, request.requestId);
      const starvationBoost = wait >= context.starvationThresholdMs ? 100_000 + Math.floor(wait / 1000) : wait / 1000;
      return result(this.name, request.requestId, starvationBoost - grants * 100, [`Owner has ${grants} previous recorded grants.`, `Wait time contributes ${wait} ms; threshold relief is ${wait >= context.starvationThresholdMs ? 'active' : 'not active'}.`]);
    });
  }
}
export class ReservationFirstPolicy implements Policy {
  readonly name = 'reservation-first' as const;
  evaluate(context: PolicyContext): PolicyResult[] { return ordered(context).map((request) => result(this.name, request.requestId, request.reservationId ? 10_000 : 0, [request.reservationId ? `Reservation ${request.reservationId} is recognized as policy evidence.` : 'No reservation evidence supplied.'])); }
}
export class ExclusiveAccessPolicy implements Policy {
  readonly name = 'exclusive-access' as const;
  evaluate(context: PolicyContext): PolicyResult[] { return ordered(context).map((request) => {
    const availability = context.constraints.get(request.requestId)?.availability;
    const blocked = request.mode === 'exclusive' && availability?.existingExclusiveAllocation === true;
    return result(this.name, request.requestId, request.mode === 'exclusive' ? 20 : 0, [blocked ? 'Existing exclusive allocation blocks this exclusive request.' : request.mode === 'exclusive' ? 'Exclusive mode is evaluated as an explicit policy request.' : 'Request is not exclusive.'], !blocked);
  }); }
}
export class SharedAllocationPolicy implements Policy {
  readonly name = 'shared-allocation' as const;
  evaluate(context: PolicyContext): PolicyResult[] { return ordered(context).map((request) => {
    const available = context.constraints.get(request.requestId)?.availability.availableCapacity;
    const capacityFits = available === undefined || available >= request.capacity;
    const shared = request.mode === 'shared' || request.mode === 'partial';
    return result(this.name, request.requestId, shared ? 10 : 0, [shared ? 'Shared/partial request is compatible with shared-allocation policy.' : 'Request does not request shared allocation.'], !shared || capacityFits);
  }); }
}
export class EmergencyOverridePolicy implements Policy {
  readonly name = 'emergency-override' as const;
  evaluate(context: PolicyContext): PolicyResult[] { return ordered(context).map((request) => result(this.name, request.requestId, request.emergency ? 1_000_000 : 0, [request.emergency ? 'Externally classified emergency receives override priority.' : 'No emergency classification supplied.'])); }
}
export class FutureAiRecommendationsAdvisoryOnlyPolicy implements Policy {
  readonly name = 'future-ai-recommendations-advisory-only' as const;
  evaluate(context: PolicyContext): PolicyResult[] { return ordered(context).map((request) => result(this.name, request.requestId, 0, [request.aiRecommendation ? `AI recommendation recorded as advisory evidence: ${request.aiRecommendation}` : 'No AI recommendation supplied; AI can never alter this deterministic score.'], true, true)); }
}

export class PolicyRegistry {
  private policies = new Map<ArbitrationPolicyName, Policy>();
  constructor(policies: Policy[] = defaultPolicies()) { for (const policy of policies) this.register(policy); }
  register(policy: Policy): void { this.policies.set(policy.name, policy); }
  remove(name: ArbitrationPolicyName): boolean { return this.policies.delete(name); }
  get(name: ArbitrationPolicyName): Policy | undefined { return this.policies.get(name); }
  all(): Policy[] { return [...this.policies.values()].sort((a, b) => a.name.localeCompare(b.name)); }
  evaluate(context: PolicyContext): PolicyResult[] { return this.all().flatMap((policy) => policy.evaluate(context)); }
}
export function defaultPolicies(): Policy[] { return [new FirstComeFirstServedPolicy(), new PriorityBasedPolicy(), new FairSharePolicy(), new ReservationFirstPolicy(), new ExclusiveAccessPolicy(), new SharedAllocationPolicy(), new EmergencyOverridePolicy(), new FutureAiRecommendationsAdvisoryOnlyPolicy()]; }
