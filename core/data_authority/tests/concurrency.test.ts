import { describe, expect, it } from 'vitest';
import { DataAuthority } from '../src/DataAuthority.js';
import { OptimisticConcurrencyError } from '../src/errors.js';
import { WIDGET_SCHEMA } from './testHelpers.js';

function makeAuthority(): DataAuthority {
  const ida = new DataAuthority();
  ida.registerDomainSchema(WIDGET_SCHEMA);
  return ida;
}

describe('Optimistic concurrency control (§8/§9 — data integrity)', () => {
  it('update() with a matching expectedRevision succeeds', () => {
    const ida = makeAuthority();
    const created = ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
    expect(() => ida.update('benchmark-results', created.id, { name: 'a', value: 2 }, 'X', { expectedRevision: created.revision })).not.toThrow();
  });

  it('update() with a stale expectedRevision is rejected', () => {
    const ida = makeAuthority();
    const created = ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
    ida.update('benchmark-results', created.id, { name: 'a', value: 2 }, 'X'); // advances revision to 2

    expect(() =>
      ida.update('benchmark-results', created.id, { name: 'a', value: 3 }, 'X', { expectedRevision: created.revision }),
    ).toThrow(OptimisticConcurrencyError);
  });

  it('a rejected concurrent update does not change the stored data', () => {
    const ida = makeAuthority();
    const created = ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
    ida.update('benchmark-results', created.id, { name: 'a', value: 2 }, 'X');

    try {
      ida.update('benchmark-results', created.id, { name: 'a', value: 999 }, 'X', { expectedRevision: created.revision });
    } catch {
      // expected
    }
    expect(ida.get('benchmark-results', created.id)?.data.value).toBe(2);
  });
});
