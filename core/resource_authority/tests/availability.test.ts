import { describe, expect, it } from 'vitest';
import { evaluateAvailability, computeEffectiveAvailable } from '../src/availability.js';
import { makeProfile } from './testHelpers.js';
import { NullPowerConstraintProvider, NullThermalConstraintProvider } from '../src/providers.js';

describe('Availability evaluation', () => {
  const power = new NullPowerConstraintProvider();
  const thermal = new NullThermalConstraintProvider();

  it('reports available for healthy resource with capacity', () => {
    const result = evaluateAvailability({
      profile: makeProfile(),
      reservations: [],
      allocations: [],
      powerProvider: power,
      thermalProvider: thermal,
      requestedCapacity: 50,
    });
    expect(result.isAvailable).toBe(true);
    expect(result.constraintViolations).toHaveLength(0);
  });

  it('blocks faulted health', () => {
    const result = evaluateAvailability({
      profile: makeProfile({ healthStatus: 'faulted' }),
      reservations: [],
      allocations: [],
      powerProvider: power,
      thermalProvider: thermal,
      requestedCapacity: 10,
    });
    expect(result.isAvailable).toBe(false);
    expect(result.constraintViolations.some((v) => v.includes('faulted'))).toBe(true);
  });

  it('blocks unavailable state', () => {
    const result = evaluateAvailability({
      profile: makeProfile({ state: 'unavailable' }),
      reservations: [],
      allocations: [],
      powerProvider: power,
      thermalProvider: thermal,
      requestedCapacity: 10,
    });
    expect(result.isAvailable).toBe(false);
  });

  it('blocks when exclusive allocation exists', () => {
    const result = evaluateAvailability({
      profile: makeProfile(),
      reservations: [],
      allocations: [
        {
          id: 'a1',
          resourceId: 'hw-gpu-001:gpu',
          owner: 'workload-a',
          requestingAuthority: 'Workload Authority',
          mode: 'exclusive',
          capacity: 100,
          leaseStart: '2026-08-08T12:00:00.000Z',
          state: 'active',
        },
      ],
      powerProvider: power,
      thermalProvider: thermal,
      requestedCapacity: 10,
    });
    expect(result.isAvailable).toBe(false);
    expect(result.constraintViolations.some((v) => v.includes('Exclusive'))).toBe(true);
  });

  it('blocks insufficient capacity', () => {
    const result = evaluateAvailability({
      profile: makeProfile({ maximumCapacity: 100, utilizedCapacity: 90 }),
      reservations: [],
      allocations: [
        {
          id: 'a1',
          resourceId: 'hw-gpu-001:gpu',
          owner: 'w',
          requestingAuthority: 'W',
          mode: 'shared',
          capacity: 90,
          leaseStart: '2026-08-08T12:00:00.000Z',
          state: 'active',
        },
      ],
      powerProvider: power,
      thermalProvider: thermal,
      requestedCapacity: 20,
    });
    expect(result.isAvailable).toBe(false);
  });

  it('computeEffectiveAvailable subtracts reservations and allocations', () => {
    const available = computeEffectiveAvailable(
      makeProfile({ maximumCapacity: 100 }),
      [{ id: 'r1', resourceId: 'x', owner: 'o', requestingAuthority: 'a', capacity: 20, startsAt: '', priority: 0, status: 'active' }],
      [{ id: 'a1', resourceId: 'x', owner: 'o', requestingAuthority: 'a', mode: 'shared', capacity: 30, leaseStart: '', state: 'active' }],
    );
    expect(available).toBe(50);
  });
});
