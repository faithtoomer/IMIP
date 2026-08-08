export { HardwareAuthority, type HardwareAuthorityOptions } from './HardwareAuthority.js';
export { HardwareRegistry } from './registry.js';
export {
  SystemInformationDiscoveryProvider,
  NoopAsicDiscoveryProvider,
  type DiscoveryProvider,
  type AsicDiscoveryProvider,
  type DiscoveryOutcome,
  type DiscoveryFailure,
} from './discovery.js';
export { classifyDevices } from './classification.js';
export { assessCapabilities, assessHealth } from './assessment.js';
export { RUNTIME_STATE_TRANSITIONS, assertRuntimeTransition, assertLifecycleTransition } from './stateMachine.js';
export { BenchmarkRegistry } from './benchmarks.js';
export { detectDuplicateDeviceIds, detectInventoryInconsistencies, type IntegrityIssue } from './integrity.js';
export { HARDWARE_EVENTS, HardwareEventBus, type HardwareEventName } from './events.js';
export { HardwareAuditTrail } from './explainability.js';
export {
  assembleDigitalTwin,
  computeSuitability,
  computeEfficiencyProfile,
  initialReliability,
  recomputeStabilityScore,
} from './digitalTwin.js';
export {
  HardwareError,
  HardwareDiscoveryError,
  HardwareStateTransitionError,
  HardwareLifecycleError,
  HardwareNotFoundError,
} from './errors.js';
export type {
  HardwareCategory,
  HardwareCapability,
  RuntimeState,
  LifecycleStage,
  HealthStatus,
  HealthSummary,
  DeviceIdentity,
  CpuInfo,
  GpuInfo,
  AsicInfo,
  MemoryInfo,
  StorageInfo,
  MotherboardInfo,
  NetworkInfo,
  CategoryInfo,
  BenchmarkResult,
  BenchmarkSummary,
  DeviceRecord,
  AllocationRecord,
  ReliabilityRecord,
  EfficiencyProfile,
  SuitabilityScore,
  DigitalTwin,
  HardwareAuditRecord,
  RawDiscoverySnapshot,
  DiscoverySnapshot,
} from './types.js';
