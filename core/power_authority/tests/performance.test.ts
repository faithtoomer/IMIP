import { describe, expect, it } from 'vitest';
import { PowerAuthority } from '../src/PowerAuthority.js';
import { InjectablePowerTelemetryProvider } from '../src/telemetry.js';
import { StaticElectricityPricingProvider } from '../src/pricing.js';
import { FLAT_PRICING, registerGpu } from './testHelpers.js';
import { synthesizeSample } from '../src/telemetry.js';

/** §18 — lightweight performance smoke tests, not a benchmarking suite. */
describe('performance smoke tests', () => {
  it('collectAndUpdate() completes well under 200ms with fake provider', async () => {
    const telemetry = new InjectablePowerTelemetryProvider();
    const authority = new PowerAuthority({
      telemetryProvider: telemetry,
      pricingProvider: new StaticElectricityPricingProvider(FLAT_PRICING),
    });
    registerGpu(authority);
    telemetry.setSamples([synthesizeSample('gpu-1', 250)]);

    const start = performance.now();
    await authority.collectAndUpdate();
    expect(performance.now() - start).toBeLessThan(200);
  });

  it('getAssessment scales reasonably across many devices', async () => {
    const telemetry = new InjectablePowerTelemetryProvider();
    const authority = new PowerAuthority({
      telemetryProvider: telemetry,
      pricingProvider: new StaticElectricityPricingProvider(FLAT_PRICING),
    });

    const samples = Array.from({ length: 50 }, (_, i) => {
      const id = `gpu-${i}`;
      authority.registerDevice({ deviceId: id, deviceType: 'gpu', maximumRatedWatts: 320, idleWatts: 25 });
      return synthesizeSample(id, 200 + i);
    });
    telemetry.setSamples(samples);
    await authority.collectAndUpdate();

    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      authority.getAssessment(`gpu-${i}`);
    }
    expect(performance.now() - start).toBeLessThan(200);
  });

  it('historical query completes well under 100ms with 1000 points', async () => {
    const telemetry = new InjectablePowerTelemetryProvider();
    const authority = new PowerAuthority({
      telemetryProvider: telemetry,
      pricingProvider: new StaticElectricityPricingProvider(FLAT_PRICING),
    });
    registerGpu(authority);

    for (let i = 0; i < 1000; i++) {
      authority.history.append({
        deviceId: 'gpu-1',
        watts: 200 + (i % 50),
        timestamp: `2026-08-08T${String(i % 24).padStart(2, '0')}:00:00Z`,
      });
    }

    const start = performance.now();
    const history = authority.getHistory('gpu-1');
    expect(performance.now() - start).toBeLessThan(100);
    expect(history).toHaveLength(1000);
  });

  it('metrics collector records telemetry latency', async () => {
    const { authority, telemetry } = await import('./testHelpers.js').then((m) => {
      const setup = m.createTestAuthority();
      m.registerGpu(setup.authority);
      setup.telemetry.setSamples([synthesizeSample('gpu-1', 200)]);
      return setup;
    });
    await authority.collectAndUpdate();
    const metrics = authority.metrics.snapshot();
    expect(metrics.telemetryLatencyMs.length).toBeGreaterThan(0);
    expect(metrics.registryUpdateCount).toBeGreaterThan(0);
  });
});
