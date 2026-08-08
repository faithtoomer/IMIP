import type { ResourceCandidate, ResourceCandidateProvider, ResourceCandidateRequest } from './types.js';

/** Empty default keeps IWIA independent until composition supplies IRIA's ranking adapter. */
export class NullResourceCandidateProvider implements ResourceCandidateProvider {
  rankCandidatesForWorkload(): ResourceCandidate[] {
    return [];
  }
}

/** Deterministic test/provider adapter keyed by workload UUID. */
export class MapResourceCandidateProvider implements ResourceCandidateProvider {
  constructor(private readonly candidates = new Map<string, ResourceCandidate[]>()) {}

  rankCandidatesForWorkload(request: ResourceCandidateRequest): ResourceCandidate[] {
    return [...(this.candidates.get(request.workloadId) ?? [])];
  }
}

export class InjectableResourceCandidateProvider implements ResourceCandidateProvider {
  constructor(private readonly fn: (request: ResourceCandidateRequest) => ResourceCandidate[]) {}

  rankCandidatesForWorkload(request: ResourceCandidateRequest): ResourceCandidate[] {
    return this.fn(request);
  }
}
