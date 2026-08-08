import { describe, expect, it } from 'vitest';
import { SchemaManager } from '../src/schemaManager.js';
import { DuplicateSchemaError, UnknownDomainError } from '../src/errors.js';
import { WIDGET_SCHEMA } from './testHelpers.js';

describe('SchemaManager (§9)', () => {
  it('registers a schema and retrieves it', () => {
    const manager = new SchemaManager();
    manager.register(WIDGET_SCHEMA);
    expect(manager.get('benchmark-results').version).toBe(1);
    expect(manager.has('benchmark-results')).toBe(true);
  });

  it('rejects a duplicate domain registration', () => {
    const manager = new SchemaManager();
    manager.register(WIDGET_SCHEMA);
    expect(() => manager.register(WIDGET_SCHEMA)).toThrow(DuplicateSchemaError);
  });

  it('get() throws UnknownDomainError for an unregistered domain', () => {
    const manager = new SchemaManager();
    expect(() => manager.get('telemetry')).toThrow(UnknownDomainError);
  });

  it('validate() catches a missing required field', () => {
    const manager = new SchemaManager();
    manager.register(WIDGET_SCHEMA);
    const errors = manager.validate('benchmark-results', { value: 5 });
    expect(errors.some((e) => e.includes('"name" is required'))).toBe(true);
  });

  it('validate() catches a type mismatch', () => {
    const manager = new SchemaManager();
    manager.register(WIDGET_SCHEMA);
    const errors = manager.validate('benchmark-results', { name: 'a', value: 'not-a-number' });
    expect(errors.some((e) => e.includes('expected type number'))).toBe(true);
  });

  it('validate() accepts a fully valid record', () => {
    const manager = new SchemaManager();
    manager.register(WIDGET_SCHEMA);
    expect(manager.validate('benchmark-results', { name: 'a', value: 5, active: true })).toEqual([]);
  });

  it('validate() runs the schema-level custom validator too', () => {
    const manager = new SchemaManager();
    manager.register({ ...WIDGET_SCHEMA, validate: (data) => (Number(data.value) < 0 ? ['value must be non-negative'] : []) });
    expect(manager.validate('benchmark-results', { name: 'a', value: -1 })).toContain('value must be non-negative');
  });
});
