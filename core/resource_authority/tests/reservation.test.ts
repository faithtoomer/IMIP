import { describe, expect, it } from 'vitest';
import { ReservationManager, detectReservationConflict } from '../src/reservation.js';
import { ReservationConflictError, CapacityOvercommitError } from '../src/errors.js';
import { makeProfile, FIXED_NOW, FIXED_LATER } from './testHelpers.js';
import { NullPowerConstraintProvider, NullThermalConstraintProvider } from '../src/providers.js';

describe('ReservationManager', () => {
  const manager = new ReservationManager();
  const baseCtx = () => ({
    profiles: [makeProfile()],
    reservations: [],
    allocations: [],
    powerProvider: new NullPowerConstraintProvider(),
    thermalProvider: new NullThermalConstraintProvider(),
    now: FIXED_NOW,
  });

  it('creates reservation', () => {
    const reservation = manager.create(baseCtx(), {
      resourceId: 'hw-gpu-001:gpu',
      owner: 'workload-a',
      requestingAuthority: 'Workload Authority',
      capacity: 30,
      priority: 5,
    });
    expect(reservation.status).toBe('active');
    expect(reservation.capacity).toBe(30);
    expect(reservation.priority).toBe(5);
  });

  it('detects priority conflict', () => {
    const conflict = detectReservationConflict(
      [
        {
          id: 'r1',
          resourceId: 'hw-gpu-001:gpu',
          owner: 'high-priority',
          requestingAuthority: 'W',
          capacity: 20,
          startsAt: FIXED_NOW,
          priority: 10,
          status: 'active',
        },
      ],
      {
        resourceId: 'hw-gpu-001:gpu',
        owner: 'low-priority',
        requestingAuthority: 'W',
        capacity: 20,
        priority: 5,
      },
      FIXED_NOW,
    );
    expect(conflict).toContain('Higher-priority');
  });

  it('rejects reservation on conflict', () => {
    const ctx = baseCtx();
    ctx.reservations.push({
      id: 'r1',
      resourceId: 'hw-gpu-001:gpu',
      owner: 'other',
      requestingAuthority: 'W',
      capacity: 80,
      startsAt: FIXED_NOW,
      priority: 10,
      status: 'active',
    });
    expect(() =>
      manager.create(ctx, {
        resourceId: 'hw-gpu-001:gpu',
        owner: 'new',
        requestingAuthority: 'W',
        capacity: 30,
        priority: 1,
      }),
    ).toThrow(ReservationConflictError);
  });

  it('rejects overcommit reservation', () => {
    expect(() =>
      manager.create(baseCtx(), {
        resourceId: 'hw-gpu-001:gpu',
        owner: 'w',
        requestingAuthority: 'W',
        capacity: 200,
      }),
    ).toThrow(CapacityOvercommitError);
  });

  it('expireReservations marks expired reservations', () => {
    const reservations = [
      {
        id: 'r1',
        resourceId: 'hw-gpu-001:gpu',
        owner: 'w',
        requestingAuthority: 'W',
        capacity: 20,
        startsAt: FIXED_NOW,
        expiresAt: FIXED_NOW,
        priority: 0,
        status: 'active' as const,
      },
      {
        id: 'r2',
        resourceId: 'hw-gpu-001:gpu',
        owner: 'w',
        requestingAuthority: 'W',
        capacity: 20,
        startsAt: FIXED_NOW,
        expiresAt: '2026-08-08T14:00:00.000Z',
        priority: 0,
        status: 'active' as const,
      },
    ];
    const expired = manager.expireReservations(reservations, FIXED_LATER);
    expect(expired).toHaveLength(1);
    expect(expired[0]?.id).toBe('r1');
  });

  it('selectCandidate picks lowest resourceId first', () => {
    const ctx = {
      ...baseCtx(),
      profiles: [
        makeProfile({ resourceId: 'z:gpu', hardwareId: 'z' }),
        makeProfile({ resourceId: 'a:gpu', hardwareId: 'a' }),
      ],
    };
    const candidate = manager.selectCandidate(ctx, {
      owner: 'w',
      requestingAuthority: 'W',
      capacity: 10,
    });
    expect(candidate?.resourceId).toBe('a:gpu');
  });
});
