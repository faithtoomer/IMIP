import { WorkloadAuthority } from '../src/WorkloadAuthority.js';
import { InjectableResourceCandidateProvider, MapResourceCandidateProvider } from '../src/providers.js';
import type { ResourceCandidate, WorkloadCreateRequest } from '../src/types.js';

export const FIXED_NOW = '2026-08-08T12:00:00.000Z';

export function makeClock(start = FIXED_NOW): { now: () => string; advance: (milliseconds: number) => void } {
  let current = Date.parse(start);
  return {
    now: () => new Date(current).toISOString(),
    advance: (milliseconds: number) => {
      current += milliseconds;
    },
  };
}

export function makeRequest(overrides: Partial<WorkloadCreateRequest> = {}): WorkloadCreateRequest {
  return {
    workloadId: 'workload-001',
    type: 'ai-inference',
    owner: 'institutional-operator',
    estimatedDurationMs: 60_000,
    priority: 70,
    priorityReason: 'Customer-facing inference workload.',
    resourceRequirements: { resourceType: 'gpu', requestedCapacity: 10, capabilityRefs: ['ai-inference'] },
    powerProfile: { expectedWatts: 250, maximumWatts: 300, reference: 'power-profile-1' },
    thermalProfile: { expectedCelsius: 70, maximumCelsius: 85, reference: 'thermal-profile-1' },
    createdReason: 'Inference request accepted by an approved upstream contract.',
    ...overrides,
  };
}

export function makeCandidate(resourceId = 'hw-gpu-001:gpu', score = 0.95): ResourceCandidate {
  return {
    resourceId,
    score,
    explanation: ['Ranked by the external resource-candidate provider.', `Score ${score}.`],
  };
}

export function makeAuthority(candidates = new Map<string, ResourceCandidate[]>(), clock = makeClock()): WorkloadAuthority {
  return new WorkloadAuthority({ resourceCandidateProvider: new MapResourceCandidateProvider(candidates), now: clock.now });
}

export function makeAuthorityWithProvider(
  fn: (request: Parameters<InjectableResourceCandidateProvider['rankCandidatesForWorkload']>[0]) => ResourceCandidate[],
  clock = makeClock(),
): WorkloadAuthority {
  return new WorkloadAuthority({ resourceCandidateProvider: new InjectableResourceCandidateProvider(fn), now: clock.now });
}

export function validatedQueued(authority: WorkloadAuthority, request = makeRequest()): string {
  const profile = authority.createWorkload(request);
  authority.validate(profile.workloadId);
  authority.queue(profile.workloadId);
  return profile.workloadId;
}

export function assignAndStart(authority: WorkloadAuthority, workloadId = validatedQueued(authority)): string {
  authority.markAssigned(workloadId, [
    { resourceId: 'hw-gpu-001:gpu', confirmedBy: 'Resource Authority', providerRank: 1, providerExplanation: ['IRIA rank evidence.'] },
  ]);
  authority.start(workloadId);
  return workloadId;
}
