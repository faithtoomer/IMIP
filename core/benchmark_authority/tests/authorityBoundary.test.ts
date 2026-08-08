import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BenchmarkAuthority } from '../src/BenchmarkAuthority.js';
import { InjectableHardwareBenchmarkStore } from '../src/providers.js';
import { completeToStored, FakeIHISBenchmarkRegistry, makeAuthority, makeInput } from './testHelpers.js';

const source = (name: string) => readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), 'utf8');

describe('IBIA authority boundaries', () => {
  it('wires an IHIS-shaped fake store through injection without importing a live HardwareAuthority', () => {
    const ihisShape = new FakeIHISBenchmarkRegistry();
    const authority = makeAuthority({ providers: { hardwareStore: new InjectableHardwareBenchmarkStore(ihisShape) } });
    const stored = completeToStored(authority, makeInput(), 123);
    expect(ihisShape.forDevice('gpu-001')).toMatchObject([{ value: 123, workload: stored.benchmarkTypeId }]);
    expect(ihisShape.summarize('gpu-001').totalResults).toBe(1);
  });

  it('does not import or instantiate hardware, resource, power, thermal, workload, or health authority classes directly', () => {
    const benchmarkSource = ['BenchmarkAuthority.ts', 'providers.ts', 'ipkb.ts'].map(source).join('\n');
    expect(benchmarkSource).not.toMatch(/from\s+['"][^'"]*(?:hardware_authority|resource_authority|power_authority|thermal_authority|workload_authority|health_authority)[^'"]*['"]/);
    expect(benchmarkSource).not.toMatch(/new\s+(?:HardwareAuthority|ResourceAuthority|PowerAuthority|ThermalAuthority|WorkloadAuthority|HealthAuthority)\b/);
  });

  it('does not expose allocation, scheduling, mining, discovery, or decision-control methods', () => {
    const methods = Object.getOwnPropertyNames(BenchmarkAuthority.prototype);
    expect(methods).not.toEqual(expect.arrayContaining(['allocate', 'reserve', 'schedule', 'mine', 'discover', 'decide', 'startRuntime']));
  });
});
