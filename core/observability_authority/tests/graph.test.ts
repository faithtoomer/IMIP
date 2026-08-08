import { describe, expect, it } from 'vitest';
import { ObservabilityGraph } from '../src/graph.js';
import type { StructuredLogRecord } from '../src/types.js';

function makeRecord(overrides: Partial<StructuredLogRecord> = {}): StructuredLogRecord {
  return {
    logId: 'log-1',
    timestamp: '2026-08-08T12:00:00.000Z',
    severity: 'information',
    category: 'runtime',
    authority: 'Test',
    operation: 'x',
    message: 'x',
    version: '1.0.0',
    ...overrides,
  };
}

describe('ObservabilityGraph (§23 — the Institutional Observability Graph)', () => {
  it('chainFor() returns the spec\'s example chain in order, regardless of insertion order', () => {
    const records: StructuredLogRecord[] = [
      makeRecord({ logId: '5', correlationId: 'boot-1', operation: 'Decision Approved', timestamp: '2026-08-08T12:00:04.000Z' }),
      makeRecord({ logId: '1', correlationId: 'boot-1', operation: 'Runtime Started', timestamp: '2026-08-08T12:00:00.000Z' }),
      makeRecord({ logId: '6', correlationId: 'boot-1', operation: 'Mining Started', timestamp: '2026-08-08T12:00:05.000Z' }),
      makeRecord({ logId: '2', correlationId: 'boot-1', operation: 'Configuration Loaded', timestamp: '2026-08-08T12:00:01.000Z' }),
    ];
    const graph = new ObservabilityGraph(() => records);
    const chain = graph.chainFor('boot-1');
    expect(chain.map((r) => r.operation)).toEqual(['Runtime Started', 'Configuration Loaded', 'Decision Approved', 'Mining Started']);
  });

  it('traceFor() groups multiple correlation chains under one trace', () => {
    const records: StructuredLogRecord[] = [
      makeRecord({ logId: '1', traceId: 't1', correlationId: 'c1', timestamp: '2026-08-08T12:00:00.000Z' }),
      makeRecord({ logId: '2', traceId: 't1', correlationId: 'c2', timestamp: '2026-08-08T12:00:01.000Z' }),
      makeRecord({ logId: '3', traceId: 't2', correlationId: 'c3', timestamp: '2026-08-08T12:00:02.000Z' }),
    ];
    const graph = new ObservabilityGraph(() => records);
    const chains = graph.traceFor('t1');
    expect(chains.map((c) => c.correlationId).sort()).toEqual(['c1', 'c2']);
  });

  it('describe() enumerates every distinct correlationId as a chain', () => {
    const records: StructuredLogRecord[] = [
      makeRecord({ logId: '1', correlationId: 'c1' }),
      makeRecord({ logId: '2', correlationId: 'c2' }),
      makeRecord({ logId: '3' }), // no correlationId — excluded
    ];
    const graph = new ObservabilityGraph(() => records);
    expect(graph.describe().chains.map((c) => c.correlationId).sort()).toEqual(['c1', 'c2']);
  });

  it('isCausallyLinked() prefers an explicit causationId over chronological inference', () => {
    const a = makeRecord({ logId: 'a', correlationId: 'c1', timestamp: '2026-08-08T12:00:05.000Z' });
    const b = makeRecord({ logId: 'b', correlationId: 'c1', timestamp: '2026-08-08T12:00:00.000Z', causationId: 'a' });
    const graph = new ObservabilityGraph(() => [a, b]);
    // b happened before a chronologically, but explicitly declares a as its cause.
    expect(graph.isCausallyLinked(a, b)).toBe(true);
  });

  it('isCausallyLinked() falls back to chronological co-occurrence within a correlationId', () => {
    const a = makeRecord({ logId: 'a', correlationId: 'c1', timestamp: '2026-08-08T12:00:00.000Z' });
    const b = makeRecord({ logId: 'b', correlationId: 'c1', timestamp: '2026-08-08T12:00:01.000Z' });
    const graph = new ObservabilityGraph(() => [a, b]);
    expect(graph.isCausallyLinked(a, b)).toBe(true);
    expect(graph.isCausallyLinked(b, a)).toBe(false);
  });
});
