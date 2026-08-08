import { describe, expect, it } from 'vitest';
import { DataAuthority } from '../src/DataAuthority.js';
import { WIDGET_SCHEMA } from './testHelpers.js';

function makeAuthority(): DataAuthority {
  const ida = new DataAuthority();
  ida.registerDomainSchema(WIDGET_SCHEMA);
  return ida;
}

describe('DataAuthority.purge() (§10 — retention lifecycle stage)', () => {
  it('deletes only records created before the cutoff', () => {
    const ida = makeAuthority();
    ida.create('benchmark-results', { name: 'old', value: 1 }, 'X', { id: 'old-record' });

    const cutoff = new Date(Date.now() + 1000); // everything created so far is "before" this
    ida.create('benchmark-results', { name: 'new-but-not-really', value: 2 }, 'X', { id: 'also-old' });

    const purged = ida.purge('benchmark-results', cutoff, 'Retention Policy');
    expect(purged).toBe(2);
    expect(ida.count('benchmark-results')).toBe(0);
  });

  it('records a purge audit entry per deleted record', () => {
    const ida = makeAuthority();
    const record = ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
    ida.purge('benchmark-results', new Date(Date.now() + 1000), 'Retention Policy', 'test cleanup');

    const entries = ida.audit.forEntity('benchmark-results', record.id);
    const purgeEntry = entries.find((e) => e.operation === 'purge');
    expect(purgeEntry).toBeDefined();
    expect(purgeEntry?.reason).toBe('test cleanup');
    expect(purgeEntry?.initiatingAuthority).toBe('Retention Policy');
  });

  it('leaves records created after the cutoff untouched', () => {
    const ida = makeAuthority();
    const cutoff = new Date(Date.now() - 1000 * 60 * 60); // one hour ago — nothing qualifies
    ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
    const purged = ida.purge('benchmark-results', cutoff, 'X');
    expect(purged).toBe(0);
    expect(ida.count('benchmark-results')).toBe(1);
  });
});
