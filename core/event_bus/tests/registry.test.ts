import { describe, expect, it } from 'vitest';
import { EventRegistry } from '../src/registry.js';
import { DuplicateEventDefinitionError, UnregisteredEventError } from '../src/errors.js';
import { makeDefinition } from './testHelpers.js';

describe('EventRegistry (§7 — SSOT for event definitions)', () => {
  it('registers a definition and retrieves it by name', () => {
    const registry = new EventRegistry();
    registry.register(makeDefinition({ name: 'A' }));
    expect(registry.get('A')?.name).toBe('A');
    expect(registry.has('A')).toBe(true);
  });

  it('rejects a duplicate event name (Law 1 — single source of event definitions)', () => {
    const registry = new EventRegistry();
    registry.register(makeDefinition({ name: 'A' }));
    expect(() => registry.register(makeDefinition({ name: 'A' }))).toThrow(DuplicateEventDefinitionError);
  });

  it('require() throws UnregisteredEventError for an unknown event', () => {
    const registry = new EventRegistry();
    expect(() => registry.require('Nope')).toThrow(UnregisteredEventError);
  });

  it('byCategory() filters correctly', () => {
    const registry = new EventRegistry();
    registry.register(makeDefinition({ name: 'A', category: 'hardware' }));
    registry.register(makeDefinition({ name: 'B', category: 'configuration' }));
    expect(registry.byCategory('hardware').map((d) => d.name)).toEqual(['A']);
  });

  it('registerAll() registers a batch', () => {
    const registry = new EventRegistry();
    registry.registerAll([makeDefinition({ name: 'A' }), makeDefinition({ name: 'B' })]);
    expect(registry.all()).toHaveLength(2);
  });
});
