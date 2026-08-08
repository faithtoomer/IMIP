import { describe, expect, it } from 'vitest';
import {
  assembleResourceDigitalTwin,
  rankCandidatesForWorkload,
  underutilizedHealthy,
  explainUnavailability,
  projectedImpactOfAllocation,
} from '../src/digitalTwin.js';
import { makeProfile, FIXED_NOW } from './testHelpers.js';
import { NullPowerConstraintProvider, NullThermalConstraintProvider } from '../src/providers.js';

describe('Institutional Resource Digital Twin (IRDT)', () => {
  const power = new NullPowerConstraintProvider();
  const thermal = new NullThermalConstraintProvider();

  it('assembles digital twin from profile and context', () => {
    const twin = assembleResourceDigitalTwin({
      profile: makeProfile(),
      ownership: null,
      allocations: [],
      reservations: [],
      powerProvider: power,
      thermalProvider: thermal,
      now: FIXED_NOW,
    });
    expect(twin.resourceId).toBe('hw-gpu-001:gpu');
    expect(twin.utilization.utilizationPercent).toBe(0);
    expect(twin.constraints.healthBlocked).toBe(false);
  });

  it('rankCandidatesForWorkload ranks by score deterministically', () => {
    const profiles = [
      makeProfile({ resourceId: 'z:gpu', hardwareId: 'z' }),
      makeProfile({ resourceId: 'a:gpu', hardwareId: 'a' }),
    ];
    const ranked = rankCandidatesForWorkload(
      profiles,
      [],
      [],
      { owner: 'w', requestingAuthority: 'W', mode: 'shared', capacity: 10 },
      power,
      thermal,
      FIXED_NOW,
    );
    expect(ranked.length).toBe(2);
    expect(ranked[0]!.score).toBeGreaterThanOrEqual(ranked[1]!.score);
  });

  it('underutilizedHealthy filters healthy low-utilization twins', () => {
    const twin = assembleResourceDigitalTwin({
      profile: makeProfile({ healthStatus: 'healthy' }),
      ownership: null,
      allocations: [],
      reservations: [],
      powerProvider: power,
      thermalProvider: thermal,
      now: FIXED_NOW,
    });
    const result = underutilizedHealthy([twin], 25);
    expect(result).toHaveLength(1);
  });

  it('explainUnavailability reports constraint blocks', () => {
    const twin = assembleResourceDigitalTwin({
      profile: makeProfile({ healthStatus: 'faulted', state: 'unavailable' }),
      ownership: null,
      allocations: [],
      reservations: [],
      powerProvider: power,
      thermalProvider: thermal,
      now: FIXED_NOW,
    });
    const explanation = explainUnavailability(twin);
    expect(explanation.some((e) => e.includes('faulted'))).toBe(true);
    expect(explanation.some((e) => e.includes('unavailable'))).toBe(true);
  });

  it('projectedImpactOfAllocation computes post-allocation metrics', () => {
    const twin = assembleResourceDigitalTwin({
      profile: makeProfile(),
      ownership: null,
      allocations: [],
      reservations: [],
      powerProvider: power,
      thermalProvider: thermal,
      now: FIXED_NOW,
    });
    const impact = projectedImpactOfAllocation(twin, 50);
    expect(impact.projectedUtilizationPercent).toBe(50);
    expect(impact.projectedAvailableCapacity).toBe(50);
    expect(impact.wouldOvercommit).toBe(false);
  });

  it('projectedImpactOfAllocation detects overcommit', () => {
    const twin = assembleResourceDigitalTwin({
      profile: makeProfile(),
      ownership: null,
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
      reservations: [],
      powerProvider: power,
      thermalProvider: thermal,
      now: FIXED_NOW,
    });
    const impact = projectedImpactOfAllocation(twin, 30);
    expect(impact.wouldOvercommit).toBe(true);
  });
});
