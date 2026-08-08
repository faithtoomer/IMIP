import { describe, expect, it } from 'vitest';
import { DataAuthority } from '../src/DataAuthority.js';
import { DuplicateRecordError, RecordNotFoundError, SchemaValidationError } from '../src/errors.js';
import { WIDGET_SCHEMA } from './testHelpers.js';

function makeAuthority(): DataAuthority {
  const ida = new DataAuthority();
  ida.registerDomainSchema(WIDGET_SCHEMA);
  return ida;
}

describe('DataAuthority CRUD (§4/§11/§12)', () => {
  it('create() persists a valid record and returns it with governance metadata', () => {
    const ida = makeAuthority();
    const record = ida.create('benchmark-results', { name: 'gpu-hashrate', value: 4200 }, 'Hardware Authority');
    expect(record.data).toEqual({ name: 'gpu-hashrate', value: 4200 });
    expect(record.lifecycleStage).toBe('persisted');
    expect(typeof record.createdAt).toBe('string');
  });

  it('create() rejects a schema-invalid record before touching storage', () => {
    const ida = makeAuthority();
    expect(() => ida.create('benchmark-results', { value: 'not-a-number' }, 'X')).toThrow(SchemaValidationError);
    expect(ida.count('benchmark-results')).toBe(0);
  });

  it('create() enforces unique fields', () => {
    const ida = makeAuthority();
    ida.create('benchmark-results', { name: 'dup', value: 1 }, 'X');
    expect(() => ida.create('benchmark-results', { name: 'dup', value: 2 }, 'X')).toThrow(DuplicateRecordError);
  });

  it('get() returns undefined for a missing record', () => {
    const ida = makeAuthority();
    expect(ida.get('benchmark-results', 'nope')).toBeUndefined();
  });

  it('update() modifies data and advances lifecycleStage', () => {
    const ida = makeAuthority();
    const created = ida.create('benchmark-results', { name: 'x', value: 1 }, 'X');
    const updated = ida.update('benchmark-results', created.id, { name: 'x', value: 2 }, 'X');
    expect(updated.data.value).toBe(2);
    expect(updated.lifecycleStage).toBe('updated');
  });

  it('update() on a nonexistent record throws RecordNotFoundError', () => {
    const ida = makeAuthority();
    expect(() => ida.update('benchmark-results', 'ghost', { name: 'x', value: 1 }, 'X')).toThrow(RecordNotFoundError);
  });

  it('delete() removes the record', () => {
    const ida = makeAuthority();
    const created = ida.create('benchmark-results', { name: 'x', value: 1 }, 'X');
    ida.delete('benchmark-results', created.id, 'X');
    expect(ida.exists('benchmark-results', created.id)).toBe(false);
  });

  it('find()/count() reflect the current record set', () => {
    const ida = makeAuthority();
    ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
    ida.create('benchmark-results', { name: 'b', value: 2 }, 'X');
    expect(ida.count('benchmark-results')).toBe(2);
    expect(ida.find('benchmark-results', { filters: [{ field: 'value', op: 'gte', value: 2 }] })).toHaveLength(1);
  });
});
