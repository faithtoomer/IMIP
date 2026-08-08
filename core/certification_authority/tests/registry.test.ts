import { describe, expect, it } from 'vitest';
import { CertificationNotFoundError } from '../src/errors.js';
import { CertificationRegistry } from '../src/registry.js';
import { evaluateAndCertify, makeAuthority, makeRequest } from './testHelpers.js';

describe('IHCA Certification Registry', () => {
  it('records UUID-shaped certification evidence, required registry metadata, and history by hardware UUID', () => {
    const authority = makeAuthority();
    const { certified, decision } = evaluateAndCertify(authority);
    const record = authority.registry.require(certified.certificationId);
    expect(record.certificationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(record).toMatchObject({
      hardwareUuid: 'hardware-001',
      deviceType: 'gpu',
      level: 'production',
      status: 'certified',
      stage: 'certified',
      auditorVersion: 'ihca-policy-v1',
      evidenceRefs: expect.any(Array),
      decision,
    });
    expect(record.evidenceRefs).toHaveLength(10);
    expect(record.nextRecertificationDue).toBe('2026-09-07T20:00:00.000Z');
    expect(authority.registry.forHardware('hardware-001')).toHaveLength(1);
  });

  it('supports upsert, ordered reads, removal, and missing-record validation', () => {
    const registry = new CertificationRegistry();
    const base = {
      hardwareUuid: 'h',
      deviceType: 'gpu',
      level: 'experimental' as const,
      status: 'pending' as const,
      stage: 'discovered' as const,
      updatedAt: '2026-08-08T20:00:00.000Z',
      evidenceRefs: [],
      auditorVersion: 'v1',
      notes: [],
      policiesApplied: [],
      revocationHistory: [],
    };
    registry.upsert({ ...base, certificationId: 'b', createdAt: '2026-08-08T20:01:00.000Z' });
    registry.upsert({ ...base, certificationId: 'a', createdAt: '2026-08-08T20:00:00.000Z' });
    expect(registry.all().map((record) => record.certificationId)).toEqual(['a', 'b']);
    expect(registry.remove('b')).toBe(true);
    expect(() => registry.require('missing')).toThrow(CertificationNotFoundError);
    expect(makeRequest().hardwareUuid).toBe('hardware-001');
  });
});
