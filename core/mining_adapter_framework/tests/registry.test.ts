import { describe, expect, it } from 'vitest';
import { AdapterNotFoundError, AdapterRegistrationError } from '../src/errors.js';
import { MockCpuAdapter, MockGpuAdapter } from '../src/mockAdapters.js';
import { makeFramework, registerCpu, registerGpu } from './testHelpers.js';

describe('IMAF Mining Backend Registry', () => {
  it('records manifests and capabilities keyed by adapter ID and queries all compatibility dimensions', async () => {
    const framework = makeFramework(); await registerCpu(framework); await registerGpu(framework);
    expect(framework.registry.all().map((record) => record.manifest.adapterId)).toEqual(['mock-cpu', 'mock-gpu']);
    expect(framework.registry.byAlgorithm('test-hash-cpu').map((record) => record.manifest.adapterId)).toEqual(['mock-cpu']);
    expect(framework.registry.byOperatingSystem('LINUX')).toHaveLength(2);
    expect(framework.registry.byHardware('gpu').map((record) => record.manifest.name)).toEqual(['Mock GPU Adapter']);
    expect(framework.registry.byProtocol('test-pool')).toHaveLength(2);
    expect(framework.registry.remove('mock-gpu')).toBe(true);
    expect(() => framework.registry.require('missing')).toThrow(AdapterNotFoundError);
  });
  it('rejects duplicate adapter IDs without mutating the registry', async () => {
    const framework = makeFramework(); await registerCpu(framework);
    await expect(framework.registerAdapter(new MockCpuAdapter())).rejects.toThrow(AdapterRegistrationError);
    expect(framework.registry.all()).toHaveLength(1);
  });
});
