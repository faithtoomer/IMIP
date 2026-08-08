import type { ArbitrationRequest, ArbitrationScore, PolicyResult, RequestConstraintEvaluation } from './types.js';

/** Pure decision-scoring surface: policies provide contributions; this module never allocates. */
export function scoreArbitrationRequests(
  requests: readonly ArbitrationRequest[],
  constraints: ReadonlyMap<string, RequestConstraintEvaluation>,
  policyResults: readonly PolicyResult[],
  firstSeenAt: ReadonlyMap<string, string>,
): ArbitrationScore[] {
  return [...requests].sort((a, b) => a.requestId.localeCompare(b.requestId)).map((request) => {
    const results = policyResults.filter((result) => result.requestId === request.requestId);
    return {
      requestId: request.requestId,
      total: results.reduce((total, result) => total + result.scoreAdjustment, 0),
      policyResults: results,
      constraint: constraints.get(request.requestId)!,
      firstSeenAt: firstSeenAt.get(request.requestId)!,
    };
  });
}

/** Stable comparison: highest aggregate score, then lexicographically smallest requestId. */
export function selectWinningScore(scores: readonly ArbitrationScore[]): ArbitrationScore | undefined {
  return scores.filter((score) => score.constraint.eligible && score.policyResults.every((result) => result.eligible))
    .sort((a, b) => b.total - a.total || a.requestId.localeCompare(b.requestId))[0];
}
