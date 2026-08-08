import type {
  BenchmarkProviders,
  BenchmarkRun,
  HardwareBenchmarkResult,
  HardwareBenchmarkStore,
  HardwareBenchmarkSummary,
  PowerProfile,
  PowerSignalProvider,
  ResourceSignal,
  ResourceSignalProvider,
  ThermalProfile,
  ThermalSignalProvider,
  WorkloadSignal,
  WorkloadSignalProvider,
} from './types.js';

/** Null and injectable providers keep IBIA independently testable and authority-isolated. */
export class NullHardwareBenchmarkStore implements HardwareBenchmarkStore {
  record(_result: HardwareBenchmarkResult): void {}
  forDevice(_deviceId: string): HardwareBenchmarkResult[] { return []; }
  summarize(_deviceId: string): HardwareBenchmarkSummary {
    return { latestByWorkload: {}, bestByWorkload: {}, totalResults: 0 };
  }
}

export class InjectableHardwareBenchmarkStore implements HardwareBenchmarkStore {
  constructor(private readonly store: HardwareBenchmarkStore) {}
  record(result: HardwareBenchmarkResult): void { this.store.record(result); }
  forDevice(deviceId: string): HardwareBenchmarkResult[] { return this.store.forDevice(deviceId); }
  summarize(deviceId: string): HardwareBenchmarkSummary { return this.store.summarize(deviceId); }
}

export class InjectablePowerSignalProvider implements PowerSignalProvider {
  constructor(private readonly fn: (run: BenchmarkRun) => PowerProfile | undefined) {}
  getPowerProfile(run: BenchmarkRun): PowerProfile | undefined { return this.fn(run); }
}
export class InjectableThermalSignalProvider implements ThermalSignalProvider {
  constructor(private readonly fn: (run: BenchmarkRun) => ThermalProfile | undefined) {}
  getThermalProfile(run: BenchmarkRun): ThermalProfile | undefined { return this.fn(run); }
}
export class InjectableResourceSignalProvider implements ResourceSignalProvider {
  constructor(private readonly fn: (run: BenchmarkRun) => ResourceSignal | undefined) {}
  getResourceSignal(run: BenchmarkRun): ResourceSignal | undefined { return this.fn(run); }
}
export class InjectableWorkloadSignalProvider implements WorkloadSignalProvider {
  constructor(private readonly fn: (run: BenchmarkRun) => WorkloadSignal | undefined) {}
  getWorkloadSignal(run: BenchmarkRun): WorkloadSignal | undefined { return this.fn(run); }
}

export function withDefaultBenchmarkProviders(providers: BenchmarkProviders = {}): Required<Pick<BenchmarkProviders, 'hardwareStore'>> & BenchmarkProviders {
  return { ...providers, hardwareStore: providers.hardwareStore ?? new NullHardwareBenchmarkStore() };
}
