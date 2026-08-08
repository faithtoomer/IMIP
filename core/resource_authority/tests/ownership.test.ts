import { describe, expect, it } from 'vitest';
import { OwnershipManager } from '../src/ownership.js';
import { InvalidOwnershipError } from '../src/errors.js';
import { FIXED_NOW, FIXED_LATER } from './testHelpers.js';

describe('OwnershipManager', () => {
  it('establishes ownership', () => {
    const manager = new OwnershipManager();
    const record = manager.establish('res-1', 'workload-a', FIXED_NOW);
    expect(record.owner).toBe('workload-a');
    expect(record.renewalHistory).toHaveLength(0);
  });

  it('transfers ownership with history', () => {
    const manager = new OwnershipManager();
    manager.establish('res-1', 'workload-a', FIXED_NOW);
    const transferred = manager.transfer('res-1', 'workload-b', FIXED_LATER, 'handoff');
    expect(transferred.owner).toBe('workload-b');
    expect(transferred.renewalHistory).toHaveLength(1);
  });

  it('renews lease with history', () => {
    const manager = new OwnershipManager();
    manager.establish('res-1', 'workload-a', FIXED_NOW, FIXED_NOW);
    const renewed = manager.renewLease('res-1', FIXED_LATER, '2026-08-09T12:00:00.000Z', 'extend');
    expect(renewed.leaseExpiration).toBe('2026-08-09T12:00:00.000Z');
    expect(renewed.renewalHistory).toHaveLength(1);
  });

  it('records release history', () => {
    const manager = new OwnershipManager();
    manager.establish('res-1', 'workload-a', FIXED_NOW);
    const released = manager.release('res-1', FIXED_LATER, 'done', 'Workload Authority');
    expect(released.releaseHistory).toHaveLength(1);
    expect(released.releaseHistory[0]?.releasedBy).toBe('Workload Authority');
  });

  it('require() throws for unknown resource', () => {
    const manager = new OwnershipManager();
    expect(() => manager.require('nope')).toThrow(InvalidOwnershipError);
  });

  it('isLeaseExpired detects expired lease', () => {
    const manager = new OwnershipManager();
    manager.establish('res-1', 'workload-a', FIXED_NOW, FIXED_LATER);
    expect(manager.isLeaseExpired('res-1', FIXED_LATER)).toBe(true);
    expect(manager.isLeaseExpired('res-1', FIXED_NOW)).toBe(false);
  });

  it('all() returns sorted records', () => {
    const manager = new OwnershipManager();
    manager.establish('z', 'a', FIXED_NOW);
    manager.establish('a', 'b', FIXED_NOW);
    expect(manager.all().map((r) => r.resourceId)).toEqual(['a', 'z']);
  });
});
