import { describe, expect, it } from 'vitest';
import { computeCapacityForecast } from '../src/forecast.js';
import { makeProfile, FIXED_NOW } from './testHelpers.js';

describe('Capacity forecast', () => {
  it('forecasts available capacity', () => {
    const forecast = computeCapacityForecast({
      profile: makeProfile(),
      allocations: [],
      reservations: [],
      forecastedAt: FIXED_NOW,
    });
    expect(forecast.availableCapacity).toBe(100);
    expect(forecast.conflicts).toHaveLength(0);
  });

  it('detects overcommit conflict', () => {
    const forecast = computeCapacityForecast({
      profile: makeProfile({ maximumCapacity: 100 }),
      allocations: [
        {
          id: 'a1',
          resourceId: 'hw-gpu-001:gpu',
          owner: 'w',
          requestingAuthority: 'W',
          mode: 'shared',
          capacity: 80,
          leaseStart: FIXED_NOW,
          state: 'active',
        },
      ],
      reservations: [
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
      forecastedAt: FIXED_NOW,
    });
    expect(forecast.conflicts.some((c) => c.includes('exceeds maximum'))).toBe(true);
  });

  it('identifies idle opportunities for underutilized healthy resources', () => {
    const forecast = computeCapacityForecast({
      profile: makeProfile({ state: 'available', healthStatus: 'healthy' }),
      allocations: [
        {
          id: 'a1',
          resourceId: 'hw-gpu-001:gpu',
          owner: 'w',
          requestingAuthority: 'W',
          mode: 'shared',
          capacity: 10,
          leaseStart: FIXED_NOW,
          state: 'active',
        },
      ],
      reservations: [],
      forecastedAt: FIXED_NOW,
    });
    expect(forecast.idleOpportunities.length).toBeGreaterThan(0);
  });

  it('projects exhaustion when fully allocated', () => {
    const forecast = computeCapacityForecast({
      profile: makeProfile(),
      allocations: [
        {
          id: 'a1',
          resourceId: 'hw-gpu-001:gpu',
          owner: 'w',
          requestingAuthority: 'W',
          mode: 'exclusive',
          capacity: 100,
          leaseStart: FIXED_NOW,
          state: 'active',
        },
      ],
      reservations: [],
      forecastedAt: FIXED_NOW,
    });
    expect(forecast.projectedExhaustionAt).toBe(FIXED_NOW);
  });
});
