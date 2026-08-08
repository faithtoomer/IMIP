import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ArbitrationAuthority } from '../src/ArbitrationAuthority.js';
import { makeAuthority, makeRequest } from './testHelpers.js';
const source = (name: string) => readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), 'utf8');

describe('IRAA authority boundaries', () => {
  it('wires a complete fake provider set through dependency injection without any live authority imports', () => {
    const authority = makeAuthority(); expect(authority.arbitrate([makeRequest(), makeRequest({ requestId: 'b', owner: 'b' })]).winningRequestId).toBe('b');
  });
  it('does not import or instantiate Resource, Health, Power, Thermal, Workload, Benchmark, or Hardware Authority classes directly', () => {
    const arbitrationSource = ['ArbitrationAuthority.ts', 'providers.ts', 'policies.ts', 'starvation.ts'].map(source).join('\n');
    expect(arbitrationSource).not.toMatch(/from\s+['"][^'"]*(?:resource_authority|health_authority|power_authority|thermal_authority|workload_authority|benchmark_authority|hardware_authority)[^'"]*['"]/);
    expect(arbitrationSource).not.toMatch(/new\s+(?:ResourceAuthority|HealthAuthority|PowerAuthority|ThermalAuthority|WorkloadAuthority|BenchmarkAuthority|HardwareAuthority)\b/);
  });
  it('does not expose allocation, reservation, registration, scheduling, mining, or runtime-control methods', () => {
    const methods = Object.getOwnPropertyNames(ArbitrationAuthority.prototype);
    expect(methods).not.toEqual(expect.arrayContaining(['allocate', 'reserve', 'register', 'requestAllocation', 'schedule', 'mine', 'startRuntime']));
  });
});
