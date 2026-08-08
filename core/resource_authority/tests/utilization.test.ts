import { describe, expect, it } from 'vitest';
import { computeUtilization, computeFleetUtilization, averageUtilizationPercent } from '../src/utilization.js';
import { makeProfile, FIXED_NOW } from './testHelpers.js';

describe('Utilization', () => {
  it('computes zero utilization for idle resource', () => {
    const metrics = computeUtilization(makeProfile(), [], [], FIXED_NOW);
    expect(metrics.utilizationPercent).toBe(0);
    expect(metrics.availableCapacity).toBe(100);
  });

  it('computes utilization from active allocations', () => {
    const metrics = computeUtilization(
      makeProfile(),
      [
        {
          id: 'a1',
          resourceId: 'hw-gpu-001:gpu',
          owner: 'w',
          requestingAuthority: 'W',
          mode: 'shared',
          capacity: 75,
          leaseStart: FIXED_NOW,
          state: 'active',
        },
      ],
      [],
      FIXED_NOW,
    );
    expect(metrics.utilizedCapacity).toBe(75);
    expect(metrics.utilizationPercent).toBe(75);
    expect(metrics.availableCapacity).toBe(25);
  });

  it('includes reservations in available calculation', () => {
    const metrics = computeUtilization(
      makeProfile(),
      [],
      [
        {
          id: 'r1',
          resourceId: 'hw-gpu-001:gpu',
          owner: 'w',
          requestingAuthority: 'W',
          capacity: 30,
          startsAt: FIXED_NOW,
          priority: 0,
          status: 'active',
        },
      ],
      FIXED_NOW,
    );
    expect(metrics.reservedCapacity).toBe(30);
    expect(metrics.availableCapacity).toBe(70);
  });

  it('computeFleetUtilization returns per-resource metrics', () => {
    const profiles = [
      makeProfile({ resourceId: 'a:gpu' }),
      makeProfile({ resourceId: 'b:gpu', hardwareId: 'b' }),
    ];
    const metrics = computeFleetUtilization(profiles, [], [], FIXED_NOW);
    expect(metrics).toHaveLength(2);
  });

  it('averageUtilizationPercent computes fleet average', () => {
    const avg = averageUtilizationPercent([
      { resourceId: 'a', utilizedCapacity: 50, availableCapacity: 50, reservedCapacity: 0, maximumCapacity: 100, utilizationPercent: 50, recordedAt: FIXED_NOW },
      { resourceId: 'b', utilizedCapacity: 25, availableCapacity: 75, reservedCapacity: 0, maximumCapacity: 100, utilizationPercent: 25, recordedAt: FIXED_NOW },
    ]);
    expect(avg).toBe(37.5);
  });
});
