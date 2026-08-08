import { describe, expect, it } from 'vitest';
import { PowerAuditTrail } from '../src/explainability.js';
import { createTestAuthority, registerGpu } from './testHelpers.js';
import { synthesizeSample } from '../src/telemetry.js';

describe('PowerAuditTrail', () => {
  it('record() appends immutable entries', () => {
    const trail = new PowerAuditTrail();
    const entry = trail.record({
      timestamp: new Date().toISOString(),
      deviceId: 'gpu-1',
      kind: 'profile-created',
      details: {},
    });
    expect(trail.all()).toHaveLength(1);
    expect(() => {
      (entry as { details: Record<string, unknown> }).details = { mutated: true };
    }).toThrow();
  });

  it('forDevice() filters by deviceId', () => {
    const trail = new PowerAuditTrail();
    const now = new Date().toISOString();
    trail.record({ timestamp: now, deviceId: 'gpu-1', kind: 'profile-created', details: {} });
    trail.record({ timestamp: now, deviceId: 'cpu-1', kind: 'profile-created', details: {} });
    expect(trail.forDevice('gpu-1')).toHaveLength(1);
  });
});

describe('PowerAuthority explainability', () => {
  it('registerDevice creates audit record', () => {
    const { authority } = createTestAuthority();
    registerGpu(authority);
    expect(authority.audit.forDevice('gpu-1').some((r) => r.kind === 'profile-created')).toBe(true);
  });

  it('collectAndUpdate creates usage, cost, and efficiency audit records', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    telemetry.setSamples([synthesizeSample('gpu-1', 200)]);
    await authority.collectAndUpdate();
    const records = authority.audit.forDevice('gpu-1');
    expect(records.some((r) => r.kind === 'usage-updated')).toBe(true);
    expect(records.some((r) => r.kind === 'cost-updated')).toBe(true);
    expect(records.some((r) => r.kind === 'efficiency-calculated')).toBe(true);
  });

  it('getAssessment returns explainability bundle', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    telemetry.setSamples([synthesizeSample('gpu-1', 200)]);
    await authority.collectAndUpdate();
    const assessment = authority.getAssessment('gpu-1');
    expect(assessment.deviceId).toBe('gpu-1');
    expect(assessment.measuredValues.currentWatts).toBe(200);
    expect(assessment.cost).toBeDefined();
    expect(assessment.efficiency).toBeDefined();
    expect(assessment.supportingMeasurements).toBeDefined();
    expect(assessment.generatedAt).toBeTruthy();
  });
});
