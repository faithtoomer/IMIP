import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CertificationAuthority } from '../src/CertificationAuthority.js';
import { fullEvidence, makeAuthority, makeRequest, providersFromEvidence } from './testHelpers.js';

const source = (name: string) => readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), 'utf8');

describe('IHCA authority boundaries', () => {
  it('wires a complete all-fake provider set through dependency injection with zero live authority imports', () => {
    const authority = makeAuthority({ providers: providersFromEvidence(() => fullEvidence()) });
    const started = authority.start(makeRequest());
    expect(authority.evaluate(started.certificationId).passed).toBe(true);
  });

  it('does not import or instantiate Hardware, Benchmark, Health, Power, Thermal, Resource, Workload, or Arbitration authorities directly', () => {
    const certificationSource = [
      'CertificationAuthority.ts',
      'providers.ts',
      'policies.ts',
      'trust.ts',
      'evidence.ts',
    ].map(source).join('\n');
    expect(certificationSource).not.toMatch(/from\s+['"][^'"]*(?:hardware_authority|benchmark_authority|health_authority|power_authority|thermal_authority|resource_authority|workload_authority|arbitration_authority)[^'"]*['"]/);
    expect(certificationSource).not.toMatch(/new\s+(?:HardwareAuthority|BenchmarkAuthority|HealthAuthority|PowerAuthority|ThermalAuthority|ResourceAuthority|WorkloadAuthority|ArbitrationAuthority)\b/);
  });

  it('does not expose discovery, benchmark execution, health monitoring, allocation, scheduling, or runtime-control methods', () => {
    const methods = Object.getOwnPropertyNames(CertificationAuthority.prototype);
    expect(methods).not.toEqual(expect.arrayContaining([
      'discover', 'register', 'executeBenchmark', 'monitorHealth', 'allocate', 'reserve', 'schedule', 'startRuntime',
    ]));
  });
});
