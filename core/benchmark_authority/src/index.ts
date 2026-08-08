export { BenchmarkAuthority, type BenchmarkAuthorityOptions } from './BenchmarkAuthority.js';
export { BenchmarkCatalog, BenchmarkRunRegistry } from './registry.js';
export { BENCHMARK_LIFECYCLE, BENCHMARK_LIFECYCLE_TRANSITIONS, assertBenchmarkLifecycleTransition } from './lifecycle.js';
export { compareBenchmarkRuns, performanceTrend, type ComparisonOptions } from './comparison.js';
export { BenchmarkAuditTrail, explainBenchmark } from './explainability.js';
export { InstitutionalPerformanceKnowledgeBase } from './ipkb.js';
export { BENCHMARK_EVENTS, BENCHMARK_EVENT_DEFINITIONS, BenchmarkEventBus, type BenchmarkEventName } from './events.js';
export {
  NullHardwareBenchmarkStore,
  InjectableHardwareBenchmarkStore,
  InjectablePowerSignalProvider,
  InjectableThermalSignalProvider,
  InjectableResourceSignalProvider,
  InjectableWorkloadSignalProvider,
  withDefaultBenchmarkProviders,
} from './providers.js';
export { BenchmarkError, BenchmarkNotFoundError, BenchmarkValidationError, BenchmarkLifecycleError } from './errors.js';
export type {
  BenchmarkCategory,
  BenchmarkDirection,
  BenchmarkLifecycleState,
  BenchmarkTypeDefinition,
  HardwareBenchmarkResult,
  HardwareBenchmarkSummary,
  BenchmarkEnvironment,
  HardwareProfile,
  PowerProfile,
  ThermalProfile,
  BenchmarkRunInput,
  BenchmarkRun,
  BenchmarkLifecycleRecord,
  BenchmarkComparison,
  BenchmarkRecommendation,
  BenchmarkExplanation,
  ResourceSignal,
  WorkloadSignal,
  BenchmarkCorrelation,
  InstitutionalPerformanceKnowledgeRecord,
  IPKBQuery,
  EfficiencyFinding,
  HardwareBenchmarkStore,
  PowerSignalProvider,
  ThermalSignalProvider,
  ResourceSignalProvider,
  WorkloadSignalProvider,
  BenchmarkProviders,
} from './types.js';
