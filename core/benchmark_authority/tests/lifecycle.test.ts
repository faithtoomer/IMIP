import { describe, expect, it } from 'vitest';
import { BENCHMARK_LIFECYCLE, assertBenchmarkLifecycleTransition } from '../src/lifecycle.js';
import { BenchmarkLifecycleError } from '../src/errors.js';
import { FakeIHISBenchmarkRegistry, makeAuthority, makeInput } from './testHelpers.js';

describe('IBIA eight-state benchmark lifecycle', () => {
  it('enforces every approved transition from Created through Archived and delegates raw storage to IHIS', () => {
    const store = new FakeIHISBenchmarkRegistry();
    const authority = makeAuthority({ providers: { hardwareStore: store }, now: () => '2026-08-08T20:00:00.000Z' });
    const created = authority.create(makeInput());
    expect(created.state).toBe('created');
    expect(authority.validate(created.runId).state).toBe('validated');
    expect(authority.markScheduled(created.runId, '2026-08-08T20:01:00.000Z').state).toBe('scheduled');
    expect(authority.execute(created.runId, { metric: 'hashrate', value: 100, unit: 'H/s' }, 1000).state).toBe('executed');
    expect(authority.verify(created.runId).state).toBe('verified');
    expect(authority.store(created.runId).state).toBe('stored');
    expect(store.forDevice('gpu-001')).toMatchObject([{ workload: 'mining-randomx-hashrate', value: 100 }]);
    expect(authority.compare(created.runId).classification).toBe('no-baseline');
    expect(authority.archive(created.runId).state).toBe('archived');
    expect(authority.audit.forRun(created.runId).map((record) => record.to)).toEqual(BENCHMARK_LIFECYCLE);
  });

  it('rejects skipped, reversed, and post-archive transitions', () => {
    const authority = makeAuthority();
    const run = authority.create(makeInput());
    expect(() => authority.markScheduled(run.runId, '2026-08-08T20:01:00.000Z')).toThrow(BenchmarkLifecycleError);
    authority.validate(run.runId);
    expect(() => authority.verify(run.runId)).toThrow(BenchmarkLifecycleError);
    expect(() => assertBenchmarkLifecycleTransition('archived', 'created')).toThrow(BenchmarkLifecycleError);
  });

  it('records failure as an event condition without inventing a ninth lifecycle state', () => {
    const authority = makeAuthority();
    const run = authority.create(makeInput());
    const failed = authority.fail(run.runId, 'External runner timed out.');
    expect(failed.state).toBe('created');
    expect(failed.failureReason).toContain('timed out');
    expect(BENCHMARK_LIFECYCLE).not.toContain('failed');
  });
});
