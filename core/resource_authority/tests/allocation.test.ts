import { describe, expect, it } from 'vitest';
import { AllocationEngine } from '../src/allocation.js';
import { DoubleAllocationError, CapacityOvercommitError } from '../src/errors.js';
import { makeProfile, FIXED_NOW } from './testHelpers.js';
import { NullPowerConstraintProvider, NullThermalConstraintProvider } from '../src/providers.js';

describe('AllocationEngine', () => {
  const engine = new AllocationEngine();
  const baseCtx = () => ({
    profiles: [makeProfile()],
    reservations: [],
    allocations: [],
    powerProvider: new NullPowerConstraintProvider(),
    thermalProvider: new NullThermalConstraintProvider(),
    now: FIXED_NOW,
  });

  it('creates exclusive allocation', () => {
    const allocation = engine.allocate(baseCtx(), {
      resourceId: 'hw-gpu-001:gpu',
      owner: 'mining-workload',
      requestingAuthority: 'Workload Authority',
      mode: 'exclusive',
      capacity: 100,
    });
    expect(allocation.mode).toBe('exclusive');
    expect(allocation.state).toBe('active');
    expect(allocation.owner).toBe('mining-workload');
  });

  it('creates shared allocation', () => {
    const allocation = engine.allocate(baseCtx(), {
      resourceId: 'hw-gpu-001:gpu',
      owner: 'workload-a',
      requestingAuthority: 'Workload Authority',
      mode: 'shared',
      capacity: 40,
    });
    expect(allocation.mode).toBe('shared');
    expect(allocation.capacity).toBe(40);
  });

  it('creates temporary allocation as pending', () => {
    const allocation = engine.allocate(baseCtx(), {
      resourceId: 'hw-gpu-001:gpu',
      owner: 'temp-workload',
      requestingAuthority: 'Workload Authority',
      mode: 'temporary',
      capacity: 50,
    });
    expect(allocation.state).toBe('pending');
  });

  it('rejects double exclusive allocation', () => {
    const ctx = baseCtx();
    ctx.allocations.push({
      id: 'existing',
      resourceId: 'hw-gpu-001:gpu',
      owner: 'first',
      requestingAuthority: 'W',
      mode: 'exclusive',
      capacity: 100,
      leaseStart: FIXED_NOW,
      state: 'active',
    });
    expect(() =>
      engine.allocate(ctx, {
        resourceId: 'hw-gpu-001:gpu',
        owner: 'second',
        requestingAuthority: 'W',
        mode: 'exclusive',
        capacity: 100,
      }),
    ).toThrow(DoubleAllocationError);
  });

  it('rejects overcommit', () => {
    expect(() =>
      engine.allocate(baseCtx(), {
        resourceId: 'hw-gpu-001:gpu',
        owner: 'w',
        requestingAuthority: 'W',
        mode: 'shared',
        capacity: 150,
      }),
    ).toThrow(CapacityOvercommitError);
  });

  it('selectCandidate picks deterministically by resourceId', () => {
    const ctx = {
      ...baseCtx(),
      profiles: [
        makeProfile({ resourceId: 'z:gpu', hardwareId: 'z' }),
        makeProfile({ resourceId: 'a:gpu', hardwareId: 'a' }),
      ],
    };
    const candidate = engine.selectCandidate(
      ctx,
      { owner: 'w', requestingAuthority: 'W', mode: 'shared', capacity: 10 },
    );
    expect(candidate?.resourceId).toBe('a:gpu');
  });

  it('selectCandidate filters by resourceType', () => {
    const ctx = {
      ...baseCtx(),
      profiles: [
        makeProfile({ resourceId: 'a:gpu', resourceType: 'gpu' }),
        makeProfile({ resourceId: 'b:cpu', resourceType: 'cpu', hardwareId: 'b' }),
      ],
    };
    const candidate = engine.selectCandidate(
      ctx,
      { owner: 'w', requestingAuthority: 'W', mode: 'shared', capacity: 10, resourceType: 'cpu' },
    );
    expect(candidate?.resourceId).toBe('b:cpu');
  });
});
