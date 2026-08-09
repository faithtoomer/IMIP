import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GpuMiningFramework } from '../src/GpuMiningFramework.js';
import { config, FakeGpuAdapter, FakeGpuProviders } from './testHelpers.js';
const directory = fileURLToPath(new URL('../src/', import.meta.url));
describe('IGMF architectural authority boundaries', () => {
  it('wires a complete fake IHIS/IRIA/IPIA/ITIA/IHCA provider set and injected IMAF adapter', async () => { const providers = new FakeGpuProviders(); const framework = new GpuMiningFramework({ providers, now: () => 't' }); const session = await framework.start(config(new FakeGpuAdapter())); await framework.monitor(session.sessionId); await framework.stop(session.sessionId); expect(providers.calls).toMatchObject({ reserve: 1, release: 1 }); });
  it('imports no prohibited authority implementation or MiningAdapterFramework', () => { const source = readdirSync(directory).filter((name) => name.endsWith('.ts')).map((name) => readFileSync(`${directory}/${name}`, 'utf8')).join('\n'); expect(source).not.toMatch(/from\s+['"][^'"]*(?:hardware_authority|resource_authority|power_authority|thermal_authority|health_authority|security_authority|certification_authority|arbitration_authority|benchmark_authority|workload_authority|scheduling_authority)[^'"]*['"]/); expect(source).not.toMatch(/new\s+(?:HardwareAuthority|ResourceAuthority|PowerAuthority|ThermalAuthority|HealthAuthority|SecurityAuthority|CertificationAuthority|ArbitrationAuthority|BenchmarkAuthority|WorkloadAuthority|SchedulingAuthority|MiningAdapterFramework)\b/); });
  it('does not expose discovery allocation or power/thermal enforcement methods', () => { const methods = Object.getOwnPropertyNames(GpuMiningFramework.prototype); expect(methods).not.toEqual(expect.arrayContaining(['discoverHardware', 'allocateVram', 'selfGrantVram', 'setPowerLimit', 'setThermalLimit', 'certifyHardware', 'enforcePolicy'])); });
});
