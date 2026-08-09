import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AsicMiningFramework } from '../src/AsicMiningFramework.js';
import { config, FakeAsicAdapter, FakeAsicProviders } from './testHelpers.js';
const directory = fileURLToPath(new URL('../src/', import.meta.url));
describe('IAMF architectural authority boundaries', () => {
  it('wires the complete fake IHIS/IRIA/IPIA/ITIA/IHIA/IHCA provider set and injected IMAF adapter', async () => { const providers = new FakeAsicProviders(); const framework = new AsicMiningFramework({ providers, now: () => 't' }); framework.algorithms.register({ algorithmId: 'test-asic-algorithm-fixture', minimumFirmwareVersion: '1.0.0' }); const session = await framework.start(config(new FakeAsicAdapter())); await framework.monitor(session.sessionId); await framework.stop(session.sessionId); expect(providers.calls).toMatchObject({ reserve: 1, release: 1 }); });
  it('imports no prohibited authority implementation or MiningAdapterFramework', () => { const source = readdirSync(directory).filter((name) => name.endsWith('.ts')).map((name) => readFileSync(`${directory}/${name}`, 'utf8')).join('\n'); expect(source).not.toMatch(/from\s+['"][^'"]*(?:hardware_authority|resource_authority|power_authority|thermal_authority|health_authority|security_authority|certification_authority|arbitration_authority|benchmark_authority|workload_authority|scheduling_authority)[^'"]*['"]/); expect(source).not.toMatch(/new\s+(?:HardwareAuthority|ResourceAuthority|PowerAuthority|ThermalAuthority|HealthAuthority|SecurityAuthority|CertificationAuthority|ArbitrationAuthority|BenchmarkAuthority|WorkloadAuthority|SchedulingAuthority|MiningAdapterFramework)\b/); });
  it('does not expose discovery/allocation/power/thermal enforcement methods', () => { const methods = Object.getOwnPropertyNames(AsicMiningFramework.prototype); expect(methods).not.toEqual(expect.arrayContaining(['discoverHardware', 'allocateAsic', 'selfGrantAsic', 'setPowerLimit', 'setThermalLimit', 'certifyHardware', 'enforcePolicy'])); });
});
