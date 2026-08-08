import { BenchmarkAuthority, type BenchmarkAuthorityOptions } from '../src/BenchmarkAuthority.js';
import type { BenchmarkRunInput, BenchmarkTypeDefinition, HardwareBenchmarkResult, HardwareBenchmarkStore, HardwareBenchmarkSummary } from '../src/types.js';

export class FakeIHISBenchmarkRegistry implements HardwareBenchmarkStore {
  readonly results: HardwareBenchmarkResult[] = [];

  record(result: HardwareBenchmarkResult): void {
    this.results.push({ ...result });
  }

  forDevice(deviceId: string): HardwareBenchmarkResult[] {
    return this.results.filter((result) => result.deviceId === deviceId);
  }

  summarize(deviceId: string): HardwareBenchmarkSummary {
    const results = this.forDevice(deviceId);
    const latestByWorkload: Record<string, HardwareBenchmarkResult> = {};
    const bestByWorkload: Record<string, HardwareBenchmarkResult> = {};
    for (const result of results) {
      const latest = latestByWorkload[result.workload];
      const best = bestByWorkload[result.workload];
      if (!latest || latest.recordedAt < result.recordedAt) latestByWorkload[result.workload] = result;
      if (!best || best.value < result.value) bestByWorkload[result.workload] = result;
    }
    return { latestByWorkload, bestByWorkload, totalResults: results.length };
  }
}

export function makeClock(start = '2026-08-08T20:00:00.000Z') {
  let value = Date.parse(start);
  return {
    now: () => new Date(value).toISOString(),
    advance: (milliseconds: number) => { value += milliseconds; },
  };
}

export function makeDefinition(overrides: Partial<BenchmarkTypeDefinition> = {}): BenchmarkTypeDefinition {
  return {
    typeId: 'mining-randomx-hashrate',
    category: 'mining',
    name: 'RandomX Hashrate',
    version: '1.0.0',
    componentKinds: ['*'],
    metric: 'hashrate',
    unit: 'H/s',
    direction: 'higher-is-better',
    description: 'Standardized RandomX hashrate benchmark.',
    active: true,
    createdAt: '2026-08-08T20:00:00.000Z',
    ...overrides,
  };
}

export function makeInput(overrides: Partial<BenchmarkRunInput> = {}): BenchmarkRunInput {
  return {
    benchmarkTypeId: 'mining-randomx-hashrate',
    benchmarkVersion: '1.0.0',
    component: 'gpu',
    deviceId: 'gpu-001',
    reason: 'Establish institutional mining baseline.',
    environment: { runtimeVersion: 'node-22', miningAlgorithm: 'RandomX' },
    hardwareProfile: { deviceId: 'gpu-001', model: 'Test GPU', driverVersion: '550.0' },
    powerProfile: { averageWatts: 100 },
    thermalProfile: { averageCelsius: 65 },
    ...overrides,
  };
}

export function makeAuthority(options: BenchmarkAuthorityOptions = {}) {
  const authority = new BenchmarkAuthority(options);
  authority.registerBenchmarkType(makeDefinition());
  return authority;
}

export function completeToStored(authority: BenchmarkAuthority, input: BenchmarkRunInput = makeInput(), value = 100, durationMs = 1_000) {
  const created = authority.create(input);
  authority.validate(created.runId);
  authority.markScheduled(created.runId, '2026-08-08T20:01:00.000Z');
  authority.execute(created.runId, { metric: 'hashrate', value, unit: 'H/s' }, durationMs);
  authority.verify(created.runId, ['value is finite and unit matches definition']);
  return authority.store(created.runId);
}
