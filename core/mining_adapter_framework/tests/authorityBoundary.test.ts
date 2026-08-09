import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MiningAdapterFramework } from '../src/MiningAdapterFramework.js';
import { cpuConfig, cpuRequest, cpuStatsNormalizer, cpuTranslator, FakeSecretProvider } from './testHelpers.js';
import { MockCpuAdapter } from '../src/mockAdapters.js';

const source = (name: string) => readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), 'utf8');

describe('IMAF architectural boundaries', () => {
  it('wires the full fake injected-provider set with no live authority instance', async () => {
    const framework = new MiningAdapterFramework({ secretProvider: new FakeSecretProvider(), now: () => '2026-08-08T20:00:00.000Z' });
    await framework.registerAdapter(new MockCpuAdapter(), { configTranslator: cpuTranslator, statisticsNormalizer: cpuStatsNormalizer, errorClassifier: () => ({ category: 'UnknownFailure', message: 'fake classifier', retriable: false }) });
    expect((await framework.validateAdapter('mock-cpu', cpuRequest(), cpuConfig())).compatible).toBe(true);
    await framework.configureAdapter('mock-cpu', cpuConfig()); await framework.prepareAdapter('mock-cpu'); await framework.startAdapter('mock-cpu');
    expect((await framework.collectStatistics('mock-cpu')).hashrateHps).toBe(125);
  });
  it('does not import or instantiate implementation classes from any prohibited authority', () => {
    const frameworkSource = ['MiningAdapterFramework.ts', 'providers.ts', 'security.ts', 'negotiation.ts', 'registry.ts', 'events.ts'].map(source).join('\n');
    expect(frameworkSource).not.toMatch(/from\s+['"][^'"]*(?:hardware_authority|resource_authority|security_authority|power_authority|thermal_authority|health_authority|benchmark_authority|arbitration_authority|certification_authority|workload_authority|scheduling_authority)[^'"]*['"]/);
    expect(frameworkSource).not.toMatch(/new\s+(?:HardwareAuthority|ResourceAuthority|SecurityAuthority|PowerAuthority|ThermalAuthority|HealthAuthority|BenchmarkAuthority|ArbitrationAuthority|CertificationAuthority|WorkloadAuthority|SchedulingAuthority)\b/);
  });
  it('does not expose hardware discovery, allocation, scheduling, secret storage, or plugin discovery methods', () => {
    const methods = Object.getOwnPropertyNames(MiningAdapterFramework.prototype);
    expect(methods).not.toEqual(expect.arrayContaining(['discoverHardware', 'allocate', 'reserve', 'schedule', 'storeSecret', 'retrieveSecret', 'rotateSecret', 'scanPlugins', 'validatePluginManifest']));
  });
});
