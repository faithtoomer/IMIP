import { describe, expect, it } from 'vitest';
import { InjectablePowerSignalProvider, InjectableResourceSignalProvider, InjectableThermalSignalProvider, InjectableWorkloadSignalProvider } from '../src/providers.js';
import { FakeIHISBenchmarkRegistry, completeToStored, makeAuthority, makeInput } from './testHelpers.js';

describe('Institutional Performance Knowledge Base (IPKB)', () => {
  it('correlates stored outcomes with injected hardware/resource/power/thermal/workload evidence and answers hashrate-per-watt', () => {
    const authority = makeAuthority({
      providers: {
        hardwareStore: new FakeIHISBenchmarkRegistry(),
        power: new InjectablePowerSignalProvider((run) => ({ averageWatts: run.deviceId === 'gpu-001' ? 100 : 50, source: 'Power Authority adapter' })),
        thermal: new InjectableThermalSignalProvider(() => ({ averageCelsius: 62, source: 'Thermal Authority adapter' })),
        resource: new InjectableResourceSignalProvider(() => ({ utilizationPercent: 90, source: 'Resource Authority adapter' })),
        workload: new InjectableWorkloadSignalProvider((run) => ({ miningAlgorithm: 'RandomX', runtimeVersion: 'node-22', configurationChanges: run.deviceId === 'gpu-002' ? ['driver-551'] : [], source: 'Workload Authority adapter' })),
      },
    });
    const first = completeToStored(authority, makeInput({ deviceId: 'gpu-001' }), 150);
    authority.compare(first.runId);
    authority.archive(first.runId);
    const second = completeToStored(authority, makeInput({ deviceId: 'gpu-002', hardwareProfile: { deviceId: 'gpu-002', model: 'Efficient GPU' } }), 120);
    authority.compare(second.runId);
    const records = authority.queryKnowledge({ miningAlgorithm: 'RandomX', runtimeVersion: 'node-22' });
    expect(records).toHaveLength(2);
    expect(records[0]?.correlation).toMatchObject({ resource: { utilizationPercent: 90 }, thermal: { averageCelsius: 62 }, workload: { miningAlgorithm: 'RandomX' } });
    expect(authority.queryKnowledge({ configurationChange: 'driver-551' }).map((record) => record.deviceId)).toEqual(['gpu-002']);
    expect(authority.highestHashratePerWatt({ miningAlgorithm: 'RandomX' })).toMatchObject({ deviceId: 'gpu-002', valuePerWatt: 2.4 });
  });

  it('does not fabricate an efficiency finding when correlated power evidence is absent', () => {
    const authority = makeAuthority({ providers: { hardwareStore: new FakeIHISBenchmarkRegistry() } });
    completeToStored(authority, makeInput({ powerProfile: {} }), 100);
    expect(authority.highestHashratePerWatt()).toBeUndefined();
  });
});
