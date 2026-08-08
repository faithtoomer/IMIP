import { describe, expect, it } from 'vitest';
import { ThermalAuditTrail } from '../src/explainability.js';
import { ThermalAuthority } from '../src/ThermalAuthority.js';
import { InjectableThermalSensorProvider } from '../src/sensors.js';
import { makeSample } from './testHelpers.js';

describe('Thermal explainability (§16)', () => {
  it('ThermalAuditTrail records and retrieves entries', () => {
    const trail = new ThermalAuditTrail();
    trail.record({
      timestamp: '2026-01-01T00:00:00.000Z',
      deviceId: 'gpu-0',
      kind: 'device-registered',
      details: { deviceType: 'gpu' },
    });
    expect(trail.all()).toHaveLength(1);
    expect(trail.forDevice('gpu-0')).toHaveLength(1);
  });

  it('records are immutable (frozen)', () => {
    const trail = new ThermalAuditTrail();
    const record = trail.record({
      timestamp: '2026-01-01T00:00:00.000Z',
      deviceId: 'gpu-0',
      kind: 'device-registered',
      details: {},
    });
    expect(Object.isFrozen(record)).toBe(true);
  });

  it('registerDevice() creates audit record', () => {
    const authority = new ThermalAuthority();
    authority.registerDevice('gpu-0', 'gpu');
    const records = authority.audit.forDevice('gpu-0');
    expect(records.some((r) => r.kind === 'device-registered')).toBe(true);
  });

  it('collectAndUpdate() creates profile-updated audit record', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    provider.setSamples([makeSample()]);
    await authority.collectAndUpdate();
    const records = authority.audit.all();
    expect(records.some((r) => r.kind === 'profile-updated')).toBe(true);
  });

  it('getAssessment() provides explainable evidence', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    provider.setSamples([makeSample({ celsius: 72 })]);
    await authority.collectAndUpdate();

    const assessment = authority.getAssessment('gpu-0');
    expect(assessment.evidence.length).toBeGreaterThan(0);
    expect(assessment.evidence[0]).toMatch(/gpu-0/);
    expect(assessment.sensors.available).toBe(true);
  });

  it('setBudget() creates budget-set audit record', () => {
    const authority = new ThermalAuthority();
    authority.setBudget({
      id: 'budget-gpu',
      scope: 'gpu',
      operatingTargetCelsius: 65,
      warningThresholdCelsius: 80,
      criticalThresholdCelsius: 95,
    });
    const records = authority.audit.all();
    expect(records.some((r) => r.kind === 'budget-set')).toBe(true);
  });
});
