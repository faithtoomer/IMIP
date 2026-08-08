import type { ArbitrationDecision, ArbitrationExplanation, ArbitrationRequest } from './types.js';
/** Law 5: names competitors/resource/policies/reasons/fairness in every decision. */
export function explainArbitration(resource: string, requests: ArbitrationRequest[], decision: Omit<ArbitrationDecision, 'explanation'>): ArbitrationExplanation {
  const winner = decision.winningRequestId ? requests.find((request) => request.requestId === decision.winningRequestId) : undefined;
  const denied = decision.deferredRequests.filter((entry) => entry.disposition === 'denied').length;
  const score = decision.decisionScore === undefined ? 'No eligible request survived the supplied constraints.' : `Winning aggregate score: ${decision.decisionScore}.`;
  return {
    competingRequests: requests.map((request) => request.requestId).sort(),
    contestedResource: resource,
    scores: [],
    policies: [...decision.policiesApplied],
    constraints: [],
    decisionRationale: winner ? `Request ${winner.requestId} won deterministic arbitration. ${score}` : score,
    fairnessEvaluation: `${decision.deferredRequests.length} non-winning request(s), including ${denied} denied by constraints; tie scores are resolved lexicographically by requestId.`,
  };
}
