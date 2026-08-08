import { describe, expect, it } from 'vitest';
import { DataAuthority } from '../src/DataAuthority.js';
import { WIDGET_SCHEMA } from './testHelpers.js';

function makeAuthority(): DataAuthority {
  const ida = new DataAuthority();
  ida.registerDomainSchema(WIDGET_SCHEMA);
  return ida;
}

describe('DataAuthority.transaction() (§8 — atomic, multi-record)', () => {
  it('commits all writes together on success', () => {
    const ida = makeAuthority();
    ida.transaction(() => {
      ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
      ida.create('benchmark-results', { name: 'b', value: 2 }, 'X');
    });
    expect(ida.count('benchmark-results')).toBe(2);
  });

  it('rolls back all writes together on failure', () => {
    const ida = makeAuthority();
    expect(() =>
      ida.transaction(() => {
        ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
        throw new Error('mid-transaction failure');
      }),
    ).toThrow('mid-transaction failure');
    expect(ida.count('benchmark-results')).toBe(0);
  });

  it('nested transaction() calls use savepoints — an inner failure does not abort the outer transaction', () => {
    const ida = makeAuthority();
    ida.transaction(() => {
      ida.create('benchmark-results', { name: 'outer', value: 1 }, 'X');
      try {
        ida.transaction(() => {
          ida.create('benchmark-results', { name: 'inner', value: 2 }, 'X');
          throw new Error('inner failure');
        });
      } catch {
        // swallowed deliberately — testing that the outer transaction survives
      }
    });

    expect(ida.exists('benchmark-results', ida.find('benchmark-results', { filters: [{ field: 'name', op: 'eq', value: 'outer' }] })[0].id)).toBe(true);
    expect(ida.find('benchmark-results', { filters: [{ field: 'name', op: 'eq', value: 'inner' }] })).toEqual([]);
  });
});
