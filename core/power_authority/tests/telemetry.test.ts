import { describe, expect, it } from 'vitest';
import { InjectablePowerTelemetryProvider, synthesizeSample } from '../src/telemetry.js';
import { createTestAuthority, registerGpu } from './testHelpers.js';

describe('PowerTelemetryProvider', () => {
  it('InjectablePowerTelemetryProvider returns set samples', async () => {
    const provider = new InjectablePowerTelemetryProvider();
    const sample = synthesizeSample('gpu-1', 200);
    provider.setSamples([sample]);
    const outcome = await provider.collect();
    expect(outcome.samples).toHaveLength(1);
    expect(outcome.samples[0].watts).toBe(200);
  });

  it('InjectablePowerTelemetryProvider returns set failures', async () => {
    const provider = new InjectablePowerTelemetryProvider();
    provider.setFailures([{ deviceId: 'gpu-1', message: 'sensor offline' }]);
    const outcome = await provider.collect();
    expect(outcome.failures).toHaveLength(1);
    expect(outcome.failures[0].message).toBe('sensor offline');
  });

  it('synthesizeSample() creates a valid sample with defaults', () => {
    const sample = synthesizeSample('cpu-1', 65);
    expect(sample.deviceId).toBe('cpu-1');
    expect(sample.watts).toBe(65);
    expect(sample.sensorAvailable).toBe(true);
    expect(sample.timestamp).toBeTruthy();
  });

  it('collectAndUpdate() ingests samples from provider', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    telemetry.setSamples([synthesizeSample('gpu-1', 250)]);
    const updated = await authority.collectAndUpdate();
    expect(updated).toHaveLength(1);
    expect(authority.getProfile('gpu-1').currentWatts).toBe(250);
  });

  it('collectAndUpdate() handles telemetry failures without crashing', async () => {
    const { authority } = createTestAuthority([], [{ deviceId: 'gpu-1', message: 'timeout' }]);
    registerGpu(authority);
    await expect(authority.collectAndUpdate()).resolves.toBeDefined();
  });

  it('missing sensor sample marks profile as sensor unavailable', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    telemetry.setSamples([synthesizeSample('gpu-1', 0, { sensorAvailable: false })]);
    await authority.collectAndUpdate();
    expect(authority.getProfile('gpu-1').sensorAvailable).toBe(false);
    expect(authority.getProfile('gpu-1').healthStatus).toBe('degraded');
  });
});
