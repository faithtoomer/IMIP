import { describe, expect, it } from 'vitest';
import { LogSchemaRegistry } from '../src/schemaRegistry.js';
import { DuplicateLogSchemaError, UnregisteredLogSchemaError } from '../src/errors.js';

describe('LogSchemaRegistry (Law 2 — structured logging only)', () => {
  it('registers and requires a (category, operation) schema', () => {
    const registry = new LogSchemaRegistry();
    registry.register({ category: 'runtime', operation: 'boot-started', description: 'x' });
    expect(registry.require('runtime', 'boot-started').description).toBe('x');
  });

  it('require() throws for an unregistered pair', () => {
    const registry = new LogSchemaRegistry();
    expect(() => registry.require('runtime', 'unknown-op')).toThrow(UnregisteredLogSchemaError);
  });

  it('rejects a duplicate (category, operation) registration', () => {
    const registry = new LogSchemaRegistry();
    registry.register({ category: 'runtime', operation: 'boot-started', description: 'x' });
    expect(() => registry.register({ category: 'runtime', operation: 'boot-started', description: 'y' })).toThrow(
      DuplicateLogSchemaError,
    );
  });

  it('the same operation name is independent across categories', () => {
    const registry = new LogSchemaRegistry();
    registry.register({ category: 'runtime', operation: 'started', description: 'x' });
    expect(() => registry.register({ category: 'mining', operation: 'started', description: 'y' })).not.toThrow();
  });
});
