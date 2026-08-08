import type { ArbitrationDecision, ArbitrationKnowledgeRecord, ArbitrationRequest, IAKBQuery } from './types.js';
/** Institutional Arbitration Knowledge Base: descriptive history, never a control loop. */
export class InstitutionalArbitrationKnowledgeBase {
  private records = new Map<string, ArbitrationKnowledgeRecord>();
  record(decision: ArbitrationDecision, requests: readonly ArbitrationRequest[], now: string, grantsByOwner: ReadonlyMap<string, number>, maximumWaitMs: number): ArbitrationKnowledgeRecord {
    const winner = requests.find((request) => request.requestId === decision.winningRequestId);
    const knowledge: ArbitrationKnowledgeRecord = Object.freeze({
      knowledgeId: `iakb:${decision.arbitrationId}`,
      arbitrationId: decision.arbitrationId,
      recordedAt: now,
      contestedResource: decision.contestedResource,
      winnerOwner: winner?.owner,
      winnerRequestId: winner?.requestId,
      policyNames: [...decision.policiesApplied],
      deferredCount: decision.deferredRequests.filter((request) => request.disposition === 'deferred').length,
      deniedCount: decision.deferredRequests.filter((request) => request.disposition === 'denied').length,
      fairnessMetric: { winnerHistoricalGrants: winner ? grantsByOwner.get(winner.owner) ?? 0 : 0, maximumWaitMs, queueDepth: requests.length },
      contentionPattern: `${decision.contestedResource}:${requests.length}-request queue`,
    });
    this.records.set(knowledge.knowledgeId, knowledge);
    return knowledge;
  }
  all(): ArbitrationKnowledgeRecord[] { return [...this.records.values()].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.knowledgeId.localeCompare(b.knowledgeId)); }
  query(query: IAKBQuery = {}): ArbitrationKnowledgeRecord[] { return this.all().filter((record) => (query.resourceId === undefined || record.contestedResource === query.resourceId) && (query.owner === undefined || record.winnerOwner === query.owner) && (query.policy === undefined || record.policyNames.includes(query.policy))); }
  recurringBottlenecks(minimumOccurrences = 2): { resourceId: string; occurrences: number }[] { const counts = new Map<string, number>(); for (const record of this.all()) counts.set(record.contestedResource, (counts.get(record.contestedResource) ?? 0) + 1); return [...counts.entries()].filter(([, occurrences]) => occurrences >= minimumOccurrences).map(([resourceId, occurrences]) => ({ resourceId, occurrences })).sort((a, b) => b.occurrences - a.occurrences || a.resourceId.localeCompare(b.resourceId)); }
}
