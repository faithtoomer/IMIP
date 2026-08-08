import type { ArbitrationRequest, StarvationFinding } from './types.js';
export interface StarvationOptions { starvationThresholdMs?: number; monopolizationGrantThreshold?: number; queueImbalanceThresholdMs?: number; }
/** Stateful queue-observation data only; it makes no allocation or reservation call. */
export class StarvationDetector {
  private firstSeen = new Map<string, string>();
  private grantsByResourceOwner = new Map<string, number>();
  readonly starvationThresholdMs: number;
  private readonly monopolizationGrantThreshold: number;
  private readonly queueImbalanceThresholdMs: number;
  constructor(options: StarvationOptions = {}) { this.starvationThresholdMs = options.starvationThresholdMs ?? 60_000; this.monopolizationGrantThreshold = options.monopolizationGrantThreshold ?? 3; this.queueImbalanceThresholdMs = options.queueImbalanceThresholdMs ?? this.starvationThresholdMs; }
  observe(requests: readonly ArbitrationRequest[], now: string): void { for (const request of requests) if (!this.firstSeen.has(request.requestId)) this.firstSeen.set(request.requestId, now); }
  firstSeenAt(requestId: string, fallback: string): string { return this.firstSeen.get(requestId) ?? fallback; }
  firstSeenMap(requests: readonly ArbitrationRequest[], fallback: string): Map<string, string> { return new Map(requests.map((request) => [request.requestId, this.firstSeenAt(request.requestId, fallback)])); }
  grantsForOwners(resourceKey: string, requests: readonly ArbitrationRequest[]): Map<string, number> { return new Map(requests.map((request) => [request.owner, this.grantsByResourceOwner.get(`${resourceKey}\u0000${request.owner}`) ?? 0])); }
  maximumWaitMs(requests: readonly ArbitrationRequest[], now: string): number { return Math.max(0, ...requests.map((request) => Math.max(0, Date.parse(now) - Date.parse(this.firstSeenAt(request.requestId, now))))); }
  detect(resourceKey: string, requests: readonly ArbitrationRequest[], winningRequestId: string | undefined, now: string): StarvationFinding[] {
    const findings: StarvationFinding[] = []; const winner = requests.find((request) => request.requestId === winningRequestId);
    const waits = requests.map((request) => ({ request, wait: Math.max(0, Date.parse(now) - Date.parse(this.firstSeenAt(request.requestId, now))) }));
    for (const item of waits.filter((item) => item.wait >= this.starvationThresholdMs)) findings.push({ kind: 'long-waiting-request', resourceKey, requestIds: [item.request.requestId], detectedAt: now, details: `Request waited ${item.wait} ms (threshold ${this.starvationThresholdMs} ms).` });
    if (winner) for (const request of requests.filter((request) => request.requestId !== winner.requestId && request.priority > winner.priority)) findings.push({ kind: 'priority-inversion', resourceKey, requestIds: [winner.requestId, request.requestId].sort(), detectedAt: now, details: `Lower-priority winner ${winner.requestId} superseded request ${request.requestId}; policy evidence is retained for review.` });
    if (winner) { const grants = this.grantsByResourceOwner.get(`${resourceKey}\u0000${winner.owner}`) ?? 0; if (grants >= this.monopolizationGrantThreshold) findings.push({ kind: 'resource-monopolization', resourceKey, requestIds: [winner.requestId], detectedAt: now, details: `Owner ${winner.owner} has ${grants} prior recorded grants on this contested resource.` }); }
    if (waits.length > 1) { const min = Math.min(...waits.map((item) => item.wait)); const max = Math.max(...waits.map((item) => item.wait)); if (max - min >= this.queueImbalanceThresholdMs) findings.push({ kind: 'queue-imbalance', resourceKey, requestIds: waits.map((item) => item.request.requestId).sort(), detectedAt: now, details: `Queue wait spread is ${max - min} ms (threshold ${this.queueImbalanceThresholdMs} ms).` }); }
    return findings;
  }
  recordDecision(resourceKey: string, requests: readonly ArbitrationRequest[], winnerRequestId: string | undefined): void { if (winnerRequestId) { const winner = requests.find((request) => request.requestId === winnerRequestId); if (winner) { const key = `${resourceKey}\u0000${winner.owner}`; this.grantsByResourceOwner.set(key, (this.grantsByResourceOwner.get(key) ?? 0) + 1); } } for (const request of requests) if (request.requestId === winnerRequestId) this.firstSeen.delete(request.requestId); }
}
