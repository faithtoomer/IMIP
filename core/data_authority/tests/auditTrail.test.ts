import { describe, expect, it } from 'vitest';
import { DataAuthority } from '../src/DataAuthority.js';
import { REDACTED } from '../src/security.js';
import { WIDGET_SCHEMA } from './testHelpers.js';

function makeAuthority(): DataAuthority {
  const ida = new DataAuthority();
  ida.registerDomainSchema(WIDGET_SCHEMA);
  return ida;
}

describe('Audit trail (§13, Law 5, Law 6)', () => {
  it('every successful create/update/delete produces an audit record answering what/who/when/outcome', () => {
    const ida = makeAuthority();
    const record = ida.create('benchmark-results', { name: 'a', value: 1 }, 'Hardware Authority', { reason: 'benchmark run' });
    ida.update('benchmark-results', record.id, { name: 'a', value: 2 }, 'Hardware Authority');
    ida.delete('benchmark-results', record.id, 'Hardware Authority');

    const entries = ida.audit.forEntity('benchmark-results', record.id);
    expect(entries.map((e) => e.operation)).toEqual(['create', 'update', 'delete']);
    expect(entries.every((e) => e.initiatingAuthority === 'Hardware Authority')).toBe(true);
    expect(entries.every((e) => e.result === 'success')).toBe(true);
    expect(entries.every((e) => typeof e.transactionId === 'string')).toBe(true);
    expect(entries[0].reason).toBe('benchmark run');
  });

  it('a failed operation still produces a permanent audit record (Law 5/6)', () => {
    const ida = makeAuthority();
    expect(() => ida.create('benchmark-results', { value: 'bad' }, 'X', { id: 'known-id' })).toThrow();

    const entries = ida.audit.forEntity('benchmark-results', 'known-id');
    expect(entries).toHaveLength(1);
    expect(entries[0].result).toBe('failure');
    expect(typeof entries[0].reason).toBe('string');
  });

  it('sensitive fields are redacted in previousValue/newValue', () => {
    const ida = makeAuthority();
    const record = ida.create('benchmark-results', { name: 'a', value: 1, secretNote: 'do-not-leak' }, 'X');
    ida.update('benchmark-results', record.id, { name: 'a', value: 2, secretNote: 'still-secret' }, 'X');

    const [, updateEntry] = ida.audit.forEntity('benchmark-results', record.id);
    expect((updateEntry.previousValue as Record<string, unknown>).secretNote).toBe(REDACTED);
    expect((updateEntry.newValue as Record<string, unknown>).secretNote).toBe(REDACTED);
    expect((updateEntry.newValue as Record<string, unknown>).value).toBe(2); // non-sensitive fields unaffected
  });

  it('audit records are immutable — DataAuditTrail exposes no update/delete method', () => {
    const ida = makeAuthority();
    expect((ida.audit as unknown as { update?: unknown }).update).toBeUndefined();
    expect((ida.audit as unknown as { delete?: unknown }).delete).toBeUndefined();
  });

  it('audit.all() supports filtering by domain/operation like any other query', () => {
    const ida = makeAuthority();
    ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
    const entries = ida.audit.all({ filters: [{ field: 'operation', op: 'eq', value: 'create' }] });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.operation === 'create')).toBe(true);
  });
});
