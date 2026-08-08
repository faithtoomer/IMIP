import { describe, expect, it } from 'vitest';
import { LogRouter } from '../src/router.js';
import type { LogSink } from '../src/sinks.js';
import type { StructuredLogRecord } from '../src/types.js';

function makeRecord(overrides: Partial<StructuredLogRecord> = {}): StructuredLogRecord {
  return {
    logId: 'log-1',
    timestamp: '2026-08-08T12:00:00.000Z',
    severity: 'information',
    category: 'runtime',
    authority: 'Test',
    operation: 'test-op',
    message: 'hello',
    version: '1.0.0',
    ...overrides,
  };
}

function spySink(name: string, throwOnWrite = false): LogSink & { calls: StructuredLogRecord[] } {
  const calls: StructuredLogRecord[] = [];
  return {
    name,
    calls,
    write(record) {
      if (throwOnWrite) throw new Error(`${name} is broken`);
      calls.push(record);
    },
  };
}

describe('LogRouter (§12)', () => {
  it('routes to every configured sink when no rule matches', () => {
    const a = spySink('a');
    const b = spySink('b');
    const router = new LogRouter([a, b], []);
    router.route(makeRecord(), () => {});
    expect(a.calls).toHaveLength(1);
    expect(b.calls).toHaveLength(1);
  });

  it('the first matching rule wins and restricts delivery to its named sinks', () => {
    const a = spySink('a');
    const b = spySink('b');
    const router = new LogRouter([a, b], [{ severity: 'information', sinks: ['a'] }]);
    router.route(makeRecord({ severity: 'information' }), () => {});
    expect(a.calls).toHaveLength(1);
    expect(b.calls).toHaveLength(0);
  });

  it('isolates a failing sink — other sinks still receive the record, and the failure is reported', () => {
    const broken = spySink('broken', true);
    const healthy = spySink('healthy');
    const router = new LogRouter([broken, healthy], []);
    const failures: string[] = [];
    const failureCount = router.route(makeRecord(), (sinkName) => failures.push(sinkName));

    expect(healthy.calls).toHaveLength(1);
    expect(failures).toEqual(['broken']);
    expect(failureCount).toBe(1);
  });

  it('matches by category alone when severity is unspecified in the rule', () => {
    const a = spySink('a');
    const b = spySink('b');
    const router = new LogRouter([a, b], [{ category: 'mining', sinks: ['a'] }]);
    router.route(makeRecord({ category: 'mining', severity: 'critical' }), () => {});
    expect(a.calls).toHaveLength(1);
    expect(b.calls).toHaveLength(0);
  });
});
