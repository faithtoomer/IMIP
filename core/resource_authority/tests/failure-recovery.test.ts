import { describe, expect, it } from 'vitest';
import { assertResourceStateTransition, canTransition } from '../src/lifecycle.js';
import { IllegalStateTransitionError } from '../src/errors.js';
import { makeAuthority, syncDefault, makeInventoryUnit } from './testHelpers.js';
import { DoubleAllocationError, ReservationConflictError } from '../src/errors.js';

describe('Failure recovery and error handling', () => {
  it('illegal state transition throws', () => {
    expect(() => assertResourceStateTransition('discovered', 'active')).toThrow(IllegalStateTransitionError);
  });

  it('canTransition returns false for illegal transitions', () => {
    expect(canTransition('retired', 'available')).toBe(false);
  });

  it('canTransition returns true for valid transitions', () => {
    expect(canTransition('available', 'reserved')).toBe(true);
    expect(canTransition('allocated', 'active')).toBe(true);
  });

  it('rejects double allocation through orchestrator', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);
    authority.requestAllocation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'first',
      requestingAuthority: 'W',
      mode: 'exclusive',
      capacity: 100,
    });
    expect(() =>
      authority.requestAllocation({
        resourceId: 'hw-gpu-001:gpu',
        owner: 'second',
        requestingAuthority: 'W',
        mode: 'exclusive',
        capacity: 100,
      }),
    ).toThrow(DoubleAllocationError);
  });

  it('rejects reservation conflict through orchestrator', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);
    authority.requestReservation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'high',
      requestingAuthority: 'W',
      capacity: 80,
      priority: 10,
    });
    expect(() =>
      authority.requestReservation({
        resourceId: 'hw-gpu-001:gpu',
        owner: 'low',
        requestingAuthority: 'W',
        capacity: 30,
        priority: 1,
      }),
    ).toThrow(ReservationConflictError);
  });

  it('getResource throws for unknown resource', async () => {
    const authority = makeAuthority();
    expect(() => authority.getResource('nope')).toThrow(/Unknown resource/);
  });

  it('recovers capacity after reservation expiry', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);
    authority.requestReservation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'w',
      requestingAuthority: 'W',
      capacity: 50,
      expiresAt: '2026-08-08T11:00:00.000Z',
    });
    expect(authority.getResource('hw-gpu-001:gpu').reservedCapacity).toBe(50);
    authority.expireReservations();
    expect(authority.getResource('hw-gpu-001:gpu').reservedCapacity).toBe(0);
  });

  it('sync updates existing resources without duplicating', async () => {
    const authority = makeAuthority([makeInventoryUnit()]);
    await syncDefault(authority);
    await syncDefault(authority);
    expect(authority.registry.all()).toHaveLength(1);
  });

  it('power blocking makes resource unavailable for assessment', async () => {
    const authority = makeAuthority([makeInventoryUnit()], {
      powerBlocking: new Map([['hw-gpu-001', true]]),
    });
    await syncDefault(authority);
    const assessment = authority.getAssessment('hw-gpu-001:gpu');
    expect(assessment.isAvailable).toBe(false);
    expect(assessment.constraintViolations.some((v) => v.includes('Power'))).toBe(true);
  });
});
