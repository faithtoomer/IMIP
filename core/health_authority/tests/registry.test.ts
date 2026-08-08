import { describe, expect, it } from 'vitest';
import { HealthAuthority } from '../src/HealthAuthority.js';
import { HealthProfileNotFoundError, HealthValidationError } from '../src/errors.js';
import { HealthRegistry } from '../src/registry.js';
import { makeAuthority, makeObservation } from './testHelpers.js';

describe('HealthRegistry', () => {
  it('keys generic profiles by component type, component id, and provider source', () => {
    const authority = makeAuthority();
    const hardware = authority.assess(makeObservation());
    const power = authority.assess(makeObservation({ providerSource: 'Power health adapter', categories: ['power'], metrics: { overallScore: 75 } }));
    expect(authority.registry.all()).toHaveLength(2);
    expect(authority.registry.get('hardware', 'gpu-001', 'Hardware health adapter')?.profileId).toBe(hardware.profileId);
    expect(authority.registry.get('hardware', 'gpu-001', 'Power health adapter')?.profileId).toBe(power.profileId);
    expect(authority.registry.byComponent('hardware', 'gpu-001')).toHaveLength(2);
  });

  it('updates an existing identity rather than duplicating it and retains historical health', () => {
    const authority = makeAuthority();
    const first = authority.assess(makeObservation());
    const second = authority.assess(makeObservation({ observedAt: '2026-08-08T12:05:00.000Z', metrics: { overallScore: 60 } }));
    expect(second.profileId).toBe(first.profileId);
    expect(authority.registry.all()).toHaveLength(1);
    expect(second.historicalHealth).toHaveLength(2);
    expect(second.currentHealth.overallScore).toBe(60);
  });

  it('supports all generic component kinds without component-specific registry logic', () => {
    const authority = makeAuthority();
    const componentTypes = ['hardware', 'resource', 'workload', 'plugin', 'authority', 'runtime', 'storage', 'database', 'communications'] as const;
    for (const componentType of componentTypes) {
      authority.assess(makeObservation({ componentType, componentId: `${componentType}-1`, providerSource: `${componentType}-provider` }));
    }
    expect(authority.registry.all().map((profile) => profile.componentType)).toEqual([...componentTypes].sort());
  });

  it('removes profiles and reports missing records', () => {
    const authority = makeAuthority();
    authority.assess(makeObservation());
    expect(authority.registry.remove('hardware', 'gpu-001', 'Hardware health adapter')).toBe(true);
    expect(() => authority.registry.require('hardware', 'gpu-001', 'Hardware health adapter')).toThrow(HealthProfileNotFoundError);
  });

  it('rejects incomplete observations', () => {
    const authority = makeAuthority();
    expect(() => authority.assess(makeObservation({ componentId: '' }))).toThrow(HealthValidationError);
    expect(() => authority.assess(makeObservation({ categories: [] }))).toThrow(/category/);
  });

  it('makes profile identity deterministic even when key parts contain delimiters', () => {
    const key = HealthRegistry.keyFor('runtime', 'worker|1', 'source|a');
    expect(key).toBe('["runtime","worker|1","source|a"]');
  });
});
