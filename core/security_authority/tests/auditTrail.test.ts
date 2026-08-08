import { describe, expect, it } from 'vitest';
import { SecurityAuditTrail } from '../src/auditTrail.js';
import type { SecurityAuditRecord } from '../src/types.js';

function makeRecord(overrides: Partial<SecurityAuditRecord> = {}): SecurityAuditRecord {
  return {
    auditId: 'a1',
    timestamp: new Date().toISOString(),
    componentId: 'c1',
    operation: 'test-op',
    decision: 'approved',
    ...overrides,
  };
}

describe('SecurityAuditTrail (§12 — immutable security audit history)', () => {
  it('records and lists entries', () => {
    const trail = new SecurityAuditTrail();
    trail.record(makeRecord());
    expect(trail.all()).toHaveLength(1);
  });

  it('forComponent() filters by componentId', () => {
    const trail = new SecurityAuditTrail();
    trail.record(makeRecord({ auditId: 'a', componentId: 'c1' }));
    trail.record(makeRecord({ auditId: 'b', componentId: 'c2' }));
    expect(trail.forComponent('c1')).toHaveLength(1);
  });

  it('denialsFor() filters by componentId and decision=denied', () => {
    const trail = new SecurityAuditTrail();
    trail.record(makeRecord({ auditId: 'a', componentId: 'c1', decision: 'approved' }));
    trail.record(makeRecord({ auditId: 'b', componentId: 'c1', decision: 'denied' }));
    expect(trail.denialsFor('c1')).toHaveLength(1);
  });

  it('records are frozen — cannot be mutated after recording', () => {
    const trail = new SecurityAuditTrail();
    trail.record(makeRecord());
    const [record] = trail.all();
    expect(() => {
      (record as { decision: string }).decision = 'denied';
    }).toThrow();
  });

  it('exposes no update or delete method (structural immutability)', () => {
    const trail = new SecurityAuditTrail();
    expect((trail as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((trail as unknown as Record<string, unknown>).delete).toBeUndefined();
  });
});
