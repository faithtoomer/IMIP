import type { ObservabilityChain, ObservabilityGraphSnapshot, StructuredLogRecord } from './types.js';

/**
 * §23 — Architect's Enhancement: the Institutional Observability Graph
 * (IOG), built in full rather than reserved. Links structured log records
 * into ordered causal chains rather than treating them as isolated rows —
 * the same "reason about resources, not raw records" shift IDA's Knowledge
 * Model and ISMA's Storage Topology already made for their domains.
 *
 * An edge between two records is explicit when the later one carries a
 * `causationId` naming the earlier one's `logId` (mirrors the Event Bus's
 * own `causationId` field); otherwise it falls back to chronological
 * co-occurrence within the same `correlationId` — a reasonable but less
 * precise approximation, since two independently-caused records can share
 * a correlationId. See ADR-0013.
 */
export class ObservabilityGraph {
  constructor(private readonly source: () => readonly StructuredLogRecord[]) {}

  /** The ordered sequence of steps sharing one correlationId — exactly the
   * shape of the spec's own example (Runtime Started -> ... -> Mining Started). */
  chainFor(correlationId: string): StructuredLogRecord[] {
    return this.source()
      .filter((record) => record.correlationId === correlationId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /** All chains touched by one traceId, grouped by correlationId. */
  traceFor(traceId: string): ObservabilityChain[] {
    const byCorrelation = new Map<string, StructuredLogRecord[]>();
    for (const record of this.source()) {
      if (record.traceId !== traceId) continue;
      const key = record.correlationId ?? '(none)';
      const bucket = byCorrelation.get(key);
      if (bucket) bucket.push(record);
      else byCorrelation.set(key, [record]);
    }
    return [...byCorrelation.entries()].map(([correlationId, steps]) => ({
      correlationId,
      steps: steps.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    }));
  }

  describe(): ObservabilityGraphSnapshot {
    const correlationIds = new Set<string>();
    for (const record of this.source()) {
      if (record.correlationId) correlationIds.add(record.correlationId);
    }
    const chains = [...correlationIds].map((correlationId) => ({ correlationId, steps: this.chainFor(correlationId) }));
    return { generatedAt: new Date().toISOString(), chains };
  }

  isCausallyLinked(a: StructuredLogRecord, b: StructuredLogRecord): boolean {
    if (b.causationId) return b.causationId === a.logId;
    return a.correlationId !== undefined && a.correlationId === b.correlationId && b.timestamp > a.timestamp;
  }
}
