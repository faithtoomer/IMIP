import { describe, expect, it } from 'vitest';
import { normalizeStructuralStatistics } from '../src/statsNormalization.js';
import { makeFramework, registerCpu, registerGpu, validateConfigurePrepareStartCpu } from './testHelpers.js';

describe('IMAF statistics normalization', () => {
  it('normalizes distinct mock backend shapes into the common institutional schema', async () => {
    const framework = makeFramework(); await registerCpu(framework); await registerGpu(framework);
    const cpu = await framework.collectStatistics('mock-cpu'); const gpu = await framework.collectStatistics('mock-gpu');
    expect(cpu).toMatchObject({ hashrateHps: 125, acceptedShares: 10, rejectedShares: 1, extensions: { cpuSpecific: 'fixture' } });
    expect(gpu).toMatchObject({ hashrateHps: 250, temperatureCelsius: 61, powerWatts: 100, efficiencyHpsPerWatt: 2.5, extensions: { backendMarker: 'fixture' } });
  });
  it('retains unknown generic statistics only in extensions', () => {
    expect(normalizeStructuralStatistics({ hashrateHps: 3, vendorMetric: 'kept' })).toEqual({ hashrateHps: 3, acceptedShares: undefined, rejectedShares: undefined, errorRate: undefined, uptimeSeconds: undefined, poolLatencyMs: undefined, workerStatus: undefined, temperatureCelsius: undefined, powerWatts: undefined, efficiencyHpsPerWatt: undefined, extensions: { vendorMetric: 'kept' } });
  });
});
