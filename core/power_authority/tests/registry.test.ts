import { describe, expect, it } from 'vitest';
import { PowerRegistry } from '../src/registry.js';
import { makeProfile } from './testHelpers.js';

describe('PowerRegistry', () => {
  it('upsert() registers a new profile', () => {
    const registry = new PowerRegistry();
    registry.upsert(makeProfile());
    expect(registry.ids()).toEqual(['gpu-1']);
  });

  it('upsert() with the same id updates rather than duplicates', () => {
    const registry = new PowerRegistry();
    registry.upsert(makeProfile());
    registry.upsert(makeProfile({ currentWatts: 300 }));
    expect(registry.all()).toHaveLength(1);
    expect(registry.get('gpu-1')?.currentWatts).toBe(300);
  });

  it('require() throws for an unknown device', () => {
    const registry = new PowerRegistry();
    expect(() => registry.require('nope')).toThrow(/not found/);
  });

  it('byDomain() filters correctly', () => {
    const registry = new PowerRegistry();
    registry.upsert(makeProfile({ deviceId: 'gpu-1', deviceType: 'gpu' }));
    registry.upsert(makeProfile({ deviceId: 'cpu-1', deviceType: 'cpu' }));
    expect(registry.byDomain('gpu')).toHaveLength(1);
    expect(registry.byDomain('cpu')).toHaveLength(1);
  });

  it('totalCurrentWatts() sums all profiles', () => {
    const registry = new PowerRegistry();
    registry.upsert(makeProfile({ deviceId: 'gpu-1', currentWatts: 200 }));
    registry.upsert(makeProfile({ deviceId: 'gpu-2', currentWatts: 150 }));
    expect(registry.totalCurrentWatts()).toBe(350);
  });

  it('remove() deletes a profile', () => {
    const registry = new PowerRegistry();
    registry.upsert(makeProfile());
    expect(registry.remove('gpu-1')).toBe(true);
    expect(registry.all()).toHaveLength(0);
  });
});
