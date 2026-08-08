import { describe, expect, it } from 'vitest';
import { ResourceRegistry } from '../src/registry.js';
import { makeProfile } from './testHelpers.js';

describe('ResourceRegistry', () => {
  it('upsert() registers a new resource', () => {
    const registry = new ResourceRegistry();
    registry.upsert(makeProfile());
    expect(registry.ids()).toEqual(['hw-gpu-001:gpu']);
  });

  it('upsert() with the same id updates rather than duplicates', () => {
    const registry = new ResourceRegistry();
    registry.upsert(makeProfile());
    registry.upsert(makeProfile({ state: 'allocated' }));
    expect(registry.all()).toHaveLength(1);
    expect(registry.get('hw-gpu-001:gpu')?.state).toBe('allocated');
  });

  it('require() throws for an unknown resource', () => {
    const registry = new ResourceRegistry();
    expect(() => registry.require('nope')).toThrow(/Unknown resource/);
  });

  it('byType() filters correctly', () => {
    const registry = new ResourceRegistry();
    registry.upsert(makeProfile({ resourceId: 'a:gpu', resourceType: 'gpu' }));
    registry.upsert(makeProfile({ resourceId: 'b:cpu', resourceType: 'cpu', hardwareId: 'hw-cpu' }));
    expect(registry.byType('gpu')).toHaveLength(1);
    expect(registry.byType('cpu')).toHaveLength(1);
  });

  it('byState() filters correctly', () => {
    const registry = new ResourceRegistry();
    registry.upsert(makeProfile({ state: 'available' }));
    registry.upsert(makeProfile({ resourceId: 'b:gpu', state: 'allocated' }));
    expect(registry.byState('available')).toHaveLength(1);
    expect(registry.byState('allocated')).toHaveLength(1);
  });

  it('byHardwareId() filters correctly', () => {
    const registry = new ResourceRegistry();
    registry.upsert(makeProfile({ hardwareId: 'hw-1' }));
    registry.upsert(makeProfile({ resourceId: 'hw-2:gpu', hardwareId: 'hw-2' }));
    expect(registry.byHardwareId('hw-1')).toHaveLength(1);
  });

  it('byCapability() filters correctly', () => {
    const registry = new ResourceRegistry();
    registry.upsert(makeProfile({ capabilityRefs: ['gpu-mining'] }));
    registry.upsert(makeProfile({ resourceId: 'b:cpu', capabilityRefs: ['cpu-mining'] }));
    expect(registry.byCapability('gpu-mining')).toHaveLength(1);
  });

  it('all() returns sorted by resourceId', () => {
    const registry = new ResourceRegistry();
    registry.upsert(makeProfile({ resourceId: 'z:gpu' }));
    registry.upsert(makeProfile({ resourceId: 'a:gpu' }));
    expect(registry.all().map((p) => p.resourceId)).toEqual(['a:gpu', 'z:gpu']);
  });

  it('remove() deletes a resource', () => {
    const registry = new ResourceRegistry();
    registry.upsert(makeProfile());
    expect(registry.remove('hw-gpu-001:gpu')).toBe(true);
    expect(registry.all()).toHaveLength(0);
  });
});
