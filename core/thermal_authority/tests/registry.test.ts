import { describe, expect, it } from 'vitest';
import { ThermalRegistry } from '../src/registry.js';
import { ThermalNotFoundError } from '../src/errors.js';
import type { ThermalProfile } from '../src/types.js';

function makeProfile(overrides: Partial<ThermalProfile> = {}): ThermalProfile {
  return {
    deviceId: 'gpu-0',
    deviceType: 'gpu',
    currentCelsius: 65,
    thermalState: 'nominal',
    lifecycleStage: 'monitored',
    lastUpdated: new Date().toISOString(),
    sensorAvailable: true,
    ...overrides,
  };
}

describe('ThermalRegistry', () => {
  it('upserts and retrieves profiles by deviceId', () => {
    const registry = new ThermalRegistry();
    const profile = makeProfile();
    registry.upsert(profile);
    expect(registry.get('gpu-0')).toEqual(profile);
  });

  it('replaces existing profile on re-upsert', () => {
    const registry = new ThermalRegistry();
    registry.upsert(makeProfile({ currentCelsius: 60 }));
    registry.upsert(makeProfile({ currentCelsius: 75 }));
    expect(registry.get('gpu-0')?.currentCelsius).toBe(75);
  });

  it('require() throws ThermalNotFoundError for unknown device', () => {
    const registry = new ThermalRegistry();
    expect(() => registry.require('missing')).toThrow(ThermalNotFoundError);
  });

  it('all() returns all profiles', () => {
    const registry = new ThermalRegistry();
    registry.upsert(makeProfile({ deviceId: 'gpu-0' }));
    registry.upsert(makeProfile({ deviceId: 'cpu-0', deviceType: 'cpu' }));
    expect(registry.all()).toHaveLength(2);
  });

  it('byDomain() filters by device type', () => {
    const registry = new ThermalRegistry();
    registry.upsert(makeProfile({ deviceId: 'gpu-0', deviceType: 'gpu' }));
    registry.upsert(makeProfile({ deviceId: 'cpu-0', deviceType: 'cpu' }));
    expect(registry.byDomain('gpu')).toHaveLength(1);
    expect(registry.byDomain('gpu')[0].deviceId).toBe('gpu-0');
  });

  it('byState() filters by thermal state', () => {
    const registry = new ThermalRegistry();
    registry.upsert(makeProfile({ deviceId: 'a', thermalState: 'nominal' }));
    registry.upsert(makeProfile({ deviceId: 'b', thermalState: 'warning' }));
    expect(registry.byState('warning')).toHaveLength(1);
  });

  it('remove() deletes a profile', () => {
    const registry = new ThermalRegistry();
    registry.upsert(makeProfile());
    expect(registry.remove('gpu-0')).toBe(true);
    expect(registry.get('gpu-0')).toBeUndefined();
  });

  it('ids() returns all device ids', () => {
    const registry = new ThermalRegistry();
    registry.upsert(makeProfile({ deviceId: 'a' }));
    registry.upsert(makeProfile({ deviceId: 'b' }));
    expect(registry.ids()).toEqual(['a', 'b']);
  });
});
