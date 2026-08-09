import { describe, expect, it } from 'vitest';
import { AdapterLifecycleStage } from '../src/types.js';
import { cpuConfig, cpuRequest, gpuConfig, gpuRequest, makeFramework, registerCpu, registerGpu } from './testHelpers.js';

describe('IMAF universal adapter contract end to end', () => {
  it('runs MockCpuAdapter and MockGpuAdapter through one contract despite different backend shapes', async () => {
    const framework = makeFramework(); await registerCpu(framework); await registerGpu(framework);
    for (const [id, request, config] of [['mock-cpu', cpuRequest(), cpuConfig()], ['mock-gpu', gpuRequest(), gpuConfig()]] as const) {
      expect((await framework.validateAdapter(id, request, config)).compatible).toBe(true);
      await framework.configureAdapter(id, config); await framework.prepareAdapter(id); await framework.startAdapter(id);
      const statistics = await framework.collectStatistics(id); expect(statistics.hashrateHps).toBeGreaterThan(0);
      await framework.stopAdapter(id); await framework.cleanupAdapter(id); expect(framework.stage(id)).toBe(AdapterLifecycleStage.Retired);
    }
  });
});
