import { describe, expect, it } from 'vitest';
import { cpuRequest, makeFramework, registerCpu } from './testHelpers.js';

describe('IMAF deterministic capability negotiation', () => {
  it('accepts a fully compatible OS, hardware, algorithm, protocol, statistics, and control request', async () => {
    const framework = makeFramework(); await registerCpu(framework);
    const result = framework.negotiate('mock-cpu', cpuRequest());
    expect(result).toMatchObject({ adapterId: 'mock-cpu', compatible: true, reasons: [] });
    expect(result.checks.map((check) => check.subject)).toEqual(expect.arrayContaining(['operating-system', 'hardware', 'algorithm', 'pool-protocol', 'statistics', 'control-operation', 'required-capability', 'framework-version']));
  });
  it('rejects each incompatible compatibility category with deterministic reasons', async () => {
    const framework = makeFramework(); await registerCpu(framework);
    const request = cpuRequest({ operatingSystem: 'windows', hardware: { kind: 'gpu', capabilities: [] }, algorithm: 'other', poolProtocol: 'other-pool', requiredStatistics: ['temperatureCelsius'], requiredControlOperations: ['restart'], frameworkVersion: '0.9.0' });
    const first = framework.negotiate('mock-cpu', request); const second = framework.negotiate('mock-cpu', { ...request, requiredControlOperations: ['restart'], requiredStatistics: ['temperatureCelsius'] });
    expect(first).toEqual(second); expect(first.compatible).toBe(false); expect(first.reasons).toHaveLength(7);
  });
});
