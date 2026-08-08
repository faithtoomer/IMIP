export { WorkloadAuthority, type WorkloadAuthorityOptions } from './WorkloadAuthority.js';
export { WorkloadRegistry } from './registry.js';
export { WORKLOAD_STATE_TRANSITIONS, assertWorkloadStateTransition, canTransitionWorkload } from './lifecycle.js';
export { WORKLOAD_EVENTS, WorkloadEventBus, type WorkloadEventName } from './events.js';
export { WorkloadAuditTrail, explainWorkload } from './explainability.js';
export { WorkloadHistoryStore } from './history.js';
export { computeWorkloadForecast, type WorkloadForecastContext } from './forecast.js';
export { assembleWorkloadDigitalTwin, type WorkloadDigitalTwinContext } from './digitalTwin.js';
export {
  NullResourceCandidateProvider,
  MapResourceCandidateProvider,
  InjectableResourceCandidateProvider,
} from './providers.js';
export {
  WorkloadError,
  WorkloadNotFoundError,
  IllegalWorkloadStateTransitionError,
  WorkloadValidationError,
  WorkloadDependencyError,
  InvalidWorkloadPriorityError,
} from './errors.js';
export type {
  WorkloadType,
  WorkloadState,
  WorkloadRuntimeState,
  WorkloadOutcome,
  WorkloadResourceRequirements,
  WorkloadPowerProfile,
  WorkloadThermalProfile,
  WorkloadHistoricalPerformance,
  AssignedResource,
  WorkloadProfile,
  WorkloadCreateRequest,
  WorkloadTelemetrySample,
  WorkloadForecast,
  ResourceCandidate,
  ResourceCandidateRequest,
  ResourceCandidateProvider,
  WorkloadPlacementAction,
  WorkloadPlacementRecommendation,
  WorkloadBalanceRecommendation,
  WorkloadBottleneck,
  WorkloadDigitalTwin,
  WorkloadHistoryEntry,
  WorkloadAuditRecord,
  WorkloadExplanation,
} from './types.js';
