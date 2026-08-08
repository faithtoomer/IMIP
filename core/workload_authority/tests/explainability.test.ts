import { describe, expect, it } from 'vitest';
import { WorkloadAuditTrail, explainWorkload } from '../src/explainability.js';
import { assignAndStart, makeAuthority, makeRequest, validatedQueued } from './testHelpers.js';

describe('Workload explainability', () => {
  it('records immutable evidence and retrieves it by workload', () => {
    const trail = new WorkloadAuditTrail();
    const record = trail.record({ timestamp: '2026-08-08T12:00:00.000Z', workloadId: 'w-1', kind: 'created', details: {}, reason: 'test' });
    expect(Object.isFrozen(record)).toBe(true);
    expect(trail.forWorkload('w-1')).toHaveLength(1);
    expect(trail.forWorkload('other')).toHaveLength(0);
  });

  it('answers all six required why questions with assignment and completion evidence', () => {
    const authority = makeAuthority();
    const id = assignAndStart(authority);
    authority.complete(id, 'result integrity checks passed');
    const answer = authority.explain(id);
    expect(answer.created).toContain('Inference request accepted');
    expect(answer.assigned).toContain('External resource assignment');
    expect(answer.resource).toContain('hw-gpu-001:gpu');
    expect(answer.resource).toContain('IRIA rank evidence');
    expect(answer.priority).toContain('Customer-facing inference');
    expect(answer.completed).toContain('integrity checks passed');
    expect(answer.failed).toContain('Not failed');
    expect(answer.evidence.length).toBeGreaterThanOrEqual(5);
  });

  it('explains no assignment and failure without inventing successful completion', () => {
    const authority = makeAuthority();
    const id = authority.createWorkload(makeRequest()).workloadId;
    const before = authority.explain(id);
    expect(before.assigned).toContain('Not assigned');
    expect(before.resource).toContain('cannot claim or allocate');
    const running = assignAndStart(authority, validatedQueued(authority, makeRequest({ workloadId: 'failing' })));
    authority.fail(running, 'input data validation failed at runtime');
    const failure = authority.explain(running);
    expect(failure.failed).toContain('input data validation failed');
    expect(failure.completed).toContain('Not completed');
  });

  it('renders direct profile/audit evidence deterministically', () => {
    const authority = makeAuthority();
    const workload = authority.createWorkload(makeRequest());
    const explanation = explainWorkload(workload, authority.audit.forWorkload(workload.workloadId));
    expect(explanation.workloadId).toBe(workload.workloadId);
    expect(explanation.priority).toContain('70/100');
  });
});
