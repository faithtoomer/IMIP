import { describe, expect, it } from 'vitest';
import { WORKLOAD_STATE_TRANSITIONS, assertWorkloadStateTransition, canTransitionWorkload } from '../src/lifecycle.js';
import { IllegalWorkloadStateTransitionError, WorkloadDependencyError, WorkloadValidationError } from '../src/errors.js';
import { assignAndStart, makeAuthority, makeRequest, validatedQueued } from './testHelpers.js';

describe('Workload lifecycle', () => {
  it('enumerates all nine approved lifecycle states', () => {
    expect(Object.keys(WORKLOAD_STATE_TRANSITIONS)).toEqual([
      'created', 'validated', 'queued', 'assigned', 'running', 'paused', 'completed', 'failed', 'archived',
    ]);
  });

  it.each([
    ['created', 'validated'], ['validated', 'queued'], ['queued', 'assigned'], ['assigned', 'running'],
    ['running', 'paused'], ['running', 'completed'], ['running', 'failed'], ['paused', 'running'],
    ['paused', 'completed'], ['paused', 'failed'], ['completed', 'archived'], ['failed', 'archived'],
  ] as const)('permits %s → %s', (from, to) => {
    expect(canTransitionWorkload(from, to)).toBe(true);
    expect(() => assertWorkloadStateTransition(from, to)).not.toThrow();
  });

  it('permits only the cancellation archival path from non-terminal states', () => {
    expect(canTransitionWorkload('created', 'archived')).toBe(true);
    expect(canTransitionWorkload('running', 'archived')).toBe(true);
  });

  it('rejects invalid lifecycle transitions', () => {
    expect(canTransitionWorkload('created', 'running')).toBe(false);
    expect(canTransitionWorkload('archived', 'queued')).toBe(false);
    expect(() => assertWorkloadStateTransition('queued', 'completed')).toThrow(IllegalWorkloadStateTransitionError);
  });

  it('orchestrates created through completed and archived', () => {
    const authority = makeAuthority();
    const id = validatedQueued(authority);
    authority.markAssigned(id, [{ resourceId: 'r-1', confirmedBy: 'IRIA' }]);
    authority.start(id);
    authority.complete(id);
    const archived = authority.archive(id);
    expect(archived.state).toBe('archived');
    expect(archived.outcome).toBe('completed');
    expect(archived.runtimeState).toBe('archived');
  });

  it('supports pause, resume, and failure branch', () => {
    const authority = makeAuthority();
    const id = assignAndStart(authority);
    authority.pause(id);
    expect(authority.getWorkload(id).state).toBe('paused');
    authority.start(id, 'resumed after approved pause');
    const failed = authority.fail(id, 'runtime provider reported failure');
    expect(failed.state).toBe('failed');
    expect(failed.outcome).toBe('failed');
    expect(failed.historicalPerformance.failedRuns).toBe(1);
    expect(authority.archive(id).state).toBe('archived');
  });

  it('cancels without adding a tenth lifecycle state', () => {
    const authority = makeAuthority();
    const id = authority.createWorkload(makeRequest()).workloadId;
    const cancelled = authority.cancel(id, 'request withdrawn');
    expect(cancelled.state).toBe('archived');
    expect(cancelled.outcome).toBe('cancelled');
    expect(() => authority.cancel(id, 'again')).toThrow(WorkloadValidationError);
  });

  it('requires validation and completed dependencies before assignment', () => {
    const authority = makeAuthority();
    const parent = authority.createWorkload(makeRequest({ workloadId: 'parent' })).workloadId;
    const child = authority.createWorkload(makeRequest({ workloadId: 'child', dependencies: [parent] })).workloadId;
    expect(() => authority.validate(child)).not.toThrow();
    authority.queue(child);
    expect(() => authority.markAssigned(child, [{ resourceId: 'r-1', confirmedBy: 'IRIA' }])).toThrow(WorkloadDependencyError);
    authority.validate(parent);
    authority.queue(parent);
    authority.markAssigned(parent, [{ resourceId: 'r-parent', confirmedBy: 'IRIA' }]);
    authority.start(parent);
    authority.complete(parent);
    expect(authority.markAssigned(child, [{ resourceId: 'r-child', confirmedBy: 'IRIA' }]).state).toBe('assigned');
  });

  it('rejects self or unknown dependencies during validation', () => {
    const authority = makeAuthority();
    const self = authority.createWorkload(makeRequest({ workloadId: 'self', dependencies: ['self'] })).workloadId;
    const unknown = authority.createWorkload(makeRequest({ workloadId: 'unknown', dependencies: ['none'] })).workloadId;
    expect(() => authority.validate(self)).toThrow(WorkloadDependencyError);
    expect(() => authority.validate(unknown)).toThrow(WorkloadDependencyError);
  });

  it('maintains auditable priority rather than scheduling priority itself', () => {
    const authority = makeAuthority();
    const id = authority.createWorkload(makeRequest()).workloadId;
    expect(authority.setPriority(id, 95, 'operator escalation').priority).toBe(95);
    expect(authority.explain(id).priority).toContain('operator escalation');
    expect(() => authority.setPriority(id, 101, 'invalid')).toThrow(/0 through 100/);
  });
});
