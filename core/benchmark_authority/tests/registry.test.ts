import { describe, expect, it } from 'vitest';
import { BenchmarkCatalog, BenchmarkRunRegistry } from '../src/registry.js';
import { BenchmarkNotFoundError, BenchmarkValidationError } from '../src/errors.js';
import { makeAuthority, makeDefinition, makeInput } from './testHelpers.js';

describe('IBIA Benchmark Catalog and Run Registry', () => {
  it('performs catalog create, read, category query, update-through-reregistration, and delete', () => {
    const catalog = new BenchmarkCatalog();
    const definition = makeDefinition();
    catalog.register(definition);
    catalog.register(makeDefinition({ typeId: 'platform-event-bus', category: 'platform', name: 'Event Bus Throughput' }));
    expect(catalog.get('mining-randomx-hashrate', '1.0.0')?.name).toBe('RandomX Hashrate');
    expect(catalog.byCategory('platform').map((item) => item.typeId)).toEqual(['platform-event-bus']);
    catalog.register(makeDefinition({ description: 'Updated standardized definition.' }));
    expect(catalog.require('mining-randomx-hashrate', '1.0.0').description).toContain('Updated');
    expect(catalog.remove('platform-event-bus', '1.0.0')).toBe(true);
    expect(catalog.all()).toHaveLength(1);
  });

  it('supports hardware, mining, and platform benchmark types without category-specific authority classes', () => {
    const catalog = new BenchmarkCatalog();
    for (const category of ['hardware', 'mining', 'platform'] as const) {
      catalog.register(makeDefinition({ typeId: `${category}-type`, category }));
    }
    expect(catalog.all().map((item) => item.category)).toEqual(['hardware', 'mining', 'platform']);
  });

  it('keys runs by UUID/type/component/version and retains orchestration history rather than raw storage', () => {
    const authority = makeAuthority();
    const first = authority.create(makeInput());
    const second = authority.create(makeInput());
    expect(authority.registry.all()).toHaveLength(2);
    expect(BenchmarkRunRegistry.keyFor(first.runId, first.benchmarkTypeId, first.component, first.benchmarkVersion)).toContain(first.runId);
    expect(authority.registry.get(second.runId)?.state).toBe('created');
    expect(authority.registry.historyFor(first.benchmarkTypeId, first.component, first.benchmarkVersion)).toHaveLength(2);
  });

  it('rejects invalid catalog definitions, inactive definitions, and unknown records', () => {
    const catalog = new BenchmarkCatalog();
    expect(() => catalog.register(makeDefinition({ typeId: '', componentKinds: [] }))).toThrow(BenchmarkValidationError);
    const authority = makeAuthority();
    authority.registerBenchmarkType(makeDefinition({ typeId: 'inactive', active: false }));
    expect(() => authority.create(makeInput({ benchmarkTypeId: 'inactive' }))).toThrow(/inactive/);
    expect(() => authority.registry.require('missing')).toThrow(BenchmarkNotFoundError);
  });

  it('uses delimiter-safe structured keys for catalog and run identities', () => {
    expect(BenchmarkCatalog.keyFor('type|one', 'v|1')).toBe('["type|one","v|1"]');
    expect(BenchmarkRunRegistry.keyFor('run|1', 'type|one', 'component|one', 'v|1')).toBe('["run|1","type|one","component|one","v|1"]');
  });

  it('rejects empty run provenance before lifecycle orchestration starts', () => {
    const authority = makeAuthority();
    expect(() => authority.create(makeInput({ component: '' }))).toThrow(BenchmarkValidationError);
    expect(() => authority.create(makeInput({ deviceId: '' }))).toThrow(BenchmarkValidationError);
    expect(() => authority.create(makeInput({ reason: '' }))).toThrow(BenchmarkValidationError);
  });
});
