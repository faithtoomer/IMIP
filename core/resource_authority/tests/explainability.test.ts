import { describe, expect, it } from 'vitest';
import { ResourceAuditTrail } from '../src/explainability.js';
import { makeAuthority, syncDefault } from './testHelpers.js';

describe('Resource explainability', () => {
  it('ResourceAuditTrail records and retrieves entries', () => {
    const trail = new ResourceAuditTrail();
    trail.record({
      timestamp: '2026-08-08T12:00:00.000Z',
      resourceId: 'res-1',
      kind: 'registered',
      details: {},
    });
    expect(trail.all()).toHaveLength(1);
    expect(trail.forResource('res-1')).toHaveLength(1);
    expect(trail.forResource('other')).toHaveLength(0);
  });

  it('sync creates audit records', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);
    const records = authority.audit.forResource('hw-gpu-001:gpu');
    expect(records.some((r) => r.kind === 'sync-from-inventory' || r.kind === 'state-transition')).toBe(true);
  });

  it('allocation creates audit record with initiating authority', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);
    authority.requestAllocation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'w',
      requestingAuthority: 'Mining Workload Authority',
      mode: 'exclusive',
      capacity: 100,
    });
    const records = authority.audit.forResource('hw-gpu-001:gpu');
    expect(records.some((r) => r.kind === 'allocation-created')).toBe(true);
    expect(records.find((r) => r.kind === 'allocation-created')?.initiatingAuthority).toBe(
      'Mining Workload Authority',
    );
  });

  it('reservation creates audit record', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);
    authority.requestReservation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'w',
      requestingAuthority: 'Workload Authority',
      capacity: 20,
    });
    const records = authority.audit.forResource('hw-gpu-001:gpu');
    expect(records.some((r) => r.kind === 'reservation-created')).toBe(true);
  });

  it('release creates allocation-released audit record', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);
    const allocation = authority.requestAllocation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'w',
      requestingAuthority: 'Workload Authority',
      mode: 'exclusive',
      capacity: 100,
    });
    authority.release('hw-gpu-001:gpu', {
      allocationId: allocation.id,
      reason: 'done',
      initiatingAuthority: 'Workload Authority',
    });
    const records = authority.audit.forResource('hw-gpu-001:gpu');
    expect(records.some((r) => r.kind === 'allocation-released')).toBe(true);
  });
});
