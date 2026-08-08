export { ResourceAuthority, type ResourceAuthorityOptions } from './ResourceAuthority.js';
export { ResourceRegistry } from './registry.js';
export { AllocationEngine, applyAllocationToProfile, releaseAllocationFromProfile } from './allocation.js';
export {
  ReservationManager,
  applyReservationToProfile,
  releaseReservationFromProfile,
  detectReservationConflict,
} from './reservation.js';
export { OwnershipManager } from './ownership.js';
export { RESOURCE_STATE_TRANSITIONS, assertResourceStateTransition, canTransition } from './lifecycle.js';
export { evaluateAvailability, computeEffectiveAvailable, sortCandidatesByResourceId } from './availability.js';
export { computeUtilization, computeFleetUtilization, averageUtilizationPercent } from './utilization.js';
export { computeCapacityForecast, computeFleetForecast } from './forecast.js';
export { generateRecommendations, underutilizedHealthy as underutilizedHealthyProfiles } from './recommendations.js';
export {
  assembleResourceDigitalTwin,
  rankCandidatesForWorkload,
  underutilizedHealthy,
  explainUnavailability,
  projectedImpactOfAllocation,
} from './digitalTwin.js';
export { RESOURCE_EVENTS, ResourceEventBus, type ResourceEventName } from './events.js';
export { ResourceAuditTrail } from './explainability.js';
export { ResourceHistoryStore } from './history.js';
export { MetricsCollector } from './metrics.js';
export {
  NullHardwareInventoryProvider,
  MapHardwareInventoryProvider,
  InjectableHardwareInventoryProvider,
  NullPowerConstraintProvider,
  MapPowerConstraintProvider,
  InjectablePowerConstraintProvider,
  NullThermalConstraintProvider,
  MapThermalConstraintProvider,
  InjectableThermalConstraintProvider,
  type HardwareInventoryProvider,
  type HardwareInventoryUnit,
  type PowerConstraintProvider,
  type ThermalConstraintProvider,
} from './providers.js';
export {
  ResourceError,
  ResourceNotFoundError,
  DoubleAllocationError,
  ReservationConflictError,
  CapacityOvercommitError,
  InvalidOwnershipError,
  IllegalStateTransitionError,
} from './errors.js';
export type {
  ResourceType,
  ResourceState,
  HealthStatus,
  AllocationMode,
  ReservationStatus,
  AllocationState,
  Capacity,
  ResourceProfile,
  Reservation,
  Allocation,
  OwnershipRecord,
  UtilizationMetrics,
  CapacityForecast,
  ResourceRecommendation,
  ResourceAssessment,
  ResourceAuditRecord,
  ResourceMetrics,
  ResourceDigitalTwin,
  AllocationRequest,
  ReservationRequest,
  ResourceHistoryEntry,
} from './types.js';
