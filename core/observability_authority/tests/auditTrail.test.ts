import { describe, expect, it } from 'vitest';
import { AuditLogTrail } from '../src/auditTrail.js';
import type { StructuredLogRecord } from '../src/types.js';

function makeRecord(overrides: Partial<StructuredLogRecord> = {}): StructuredLogRecord {
  return {
    logId: 'log-1',
    timestamp: '2026-08-08T12:00:00.000Z',
    severity: 'audit',
    category: 'configuration',
    authority: 'ICMS',
    operation: 'value-changed',
    message: 'x',
    version: '1.0.0',
    ...overrides,
  };
}

describe('AuditLogTrail (§10 — immutable audit logging)', () => {
  it('records and lists entries', () => {
    const trail = new AuditLogTrail();
    trail.record(makeRecord());
    expect(trail.all()).toHaveLength(1);
  });

  it('filters by authority and by correlationId', () => {
    const trail = new AuditLogTrail();
    trail.record(makeRecord({ logId: 'a', authority: 'ICMS', correlationId: 'c1' }));
    trail.record(makeRecord({ logId: 'b', authority: 'IHIS', correlationId: 'c1' }));
    trail.record(makeRecord({ logId: 'c', authority: 'ICMS', correlationId: 'c2' }));

    expect(trail.forAuthority('ICMS')).toHaveLength(2);
    expect(trail.forCorrelation('c1')).toHaveLength(2);
  });

  it('records are frozen — cannot be mutated after recording', () => {
    const trail = new AuditLogTrail();
    trail.record(makeRecord());
    const [record] = trail.all();
    expect(() => {
      (record as { message: string }).message = 'tampered';
    }).toThrow();
  });

  it('exposes no update or delete method (structural immutability)', () => {
    const trail = new AuditLogTrail();
    expect((trail as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((trail as unknown as Record<string, unknown>).delete).toBeUndefined();
  });
});
