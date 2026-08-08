import { describe, expect, it } from 'vitest';
import { PowerAuthority } from '../src/PowerAuthority.js';
import { PowerNotFoundError, PowerInvalidTelemetryError, PowerLifecycleError } from '../src/errors.js';
import { validateSample } from '../src/diagnostics.js';
import { assertLifecycleTransition } from '../src/lifecycle.js';
import { createTestAuthority, registerGpu } from './testHelpers.js';
import { synthesizeSample } from '../src/telemetry.js';
import { POWER_EVENTS } from '../src/events.js';
import { vi } from 'vitest';

describe('failure handling — never crash on telemetry failures', () => {
  it('collectAndUpdate with all telemetry failures still returns', async () => {
    const { authority } = createTestAuthority([], [
      { deviceId: 'gpu-1', message: 'sensor timeout' },
      { deviceId: 'gpu-2', message: 'bus error' },
    ]);
    registerGpu(authority);
    await expect(authority.collectAndUpdate()).resolves.toBeDefined();
  });

  it('getProfile() throws for unknown device', () => {
    const { authority } = createTestAuthority();
    expect(() => authority.getProfile('missing')).toThrow(PowerNotFoundError);
  });

  it('ingestTelemetry() rejects invalid samples', () => {
    const { authority } = createTestAuthority();
    registerGpu(authority);
    expect(() =>
      authority.ingestTelemetry({
        deviceId: 'gpu-1',
        watts: -50,
        timestamp: new Date().toISOString(),
        sensorAvailable: true,
      }),
    ).toThrow();
  });

  it('validateSample() flags negative watts', () => {
    const result = validateSample({
      deviceId: 'gpu-1',
      watts: -10,
      timestamp: new Date().toISOString(),
      sensorAvailable: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Negative'))).toBe(true);
  });

  it('validateSample() flags impossible watts exceeding 2x rated', () => {
    const result = validateSample({
      deviceId: 'gpu-1',
      watts: 700,
      timestamp: new Date().toISOString(),
      sensorAvailable: true,
      maximumRatedWatts: 320,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('2x maximum rated'))).toBe(true);
  });

  it('validateSample() warns on sensor unavailable without failing', () => {
    const result = validateSample({
      deviceId: 'gpu-1',
      watts: 0,
      timestamp: new Date().toISOString(),
      sensorAvailable: false,
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('unavailable'))).toBe(true);
  });

  it('illegal lifecycle transition is rejected', () => {
    expect(() => assertLifecycleTransition('discovered', 'optimized')).toThrow(PowerLifecycleError);
  });

  it('budget recovery publishes BudgetRecovered event', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    authority.setBudget('gpu-cap', 'gpu', 200);
    const handler = vi.fn();
    authority.subscribe(POWER_EVENTS.BudgetRecovered, handler);

    telemetry.setSamples([synthesizeSample('gpu-1', 250)]);
    await authority.collectAndUpdate();
    expect(handler).not.toHaveBeenCalled();

    telemetry.setSamples([synthesizeSample('gpu-1', 150)]);
    await authority.collectAndUpdate();
    expect(handler).toHaveBeenCalled();
  });

  it('health changes to faulted when exceeding rated power', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority, 'gpu-1', 300);
    telemetry.setSamples([
      synthesizeSample('gpu-1', 310, { maximumRatedWatts: 300 }),
    ]);
    await authority.collectAndUpdate();
    expect(authority.getProfile('gpu-1').healthStatus).toBe('faulted');
  });

  it('ingestTelemetry on unregistered device throws NotFound', () => {
    const { authority } = createTestAuthority();
    expect(() =>
      authority.ingestTelemetry(synthesizeSample('unknown', 100)),
    ).toThrow(PowerNotFoundError);
  });
});
