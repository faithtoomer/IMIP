export { HealthAuthority, type HealthAuthorityOptions } from './HealthAuthority.js';
export { HealthRegistry } from './registry.js';
export { computeHealthScore, mergeHealthScoreWeights, healthStatusFor, DEFAULT_HEALTH_SCORE_WEIGHTS } from './scoring.js';
export { computeHealthForecast } from './forecast.js';
export { HealthAuditTrail, explainHealth } from './explainability.js';
export { assembleInstitutionalHealthDigitalTwin, type InstitutionalHealthDigitalTwinContext } from './digitalTwin.js';
export { HEALTH_EVENTS, HEALTH_EVENT_DEFINITIONS, HealthEventBus, type HealthEventName } from './events.js';
export {
  NullHealthSignalProvider,
  MapHealthSignalProvider,
  InjectableHealthSignalProvider,
  InjectableHardwareHealthProvider,
  InjectableResourceHealthProvider,
  InjectableWorkloadHealthProvider,
  InjectablePowerHealthProvider,
  InjectableThermalHealthProvider,
  collectHealthProviders,
} from './providers.js';
export { HealthError, HealthProfileNotFoundError, HealthValidationError } from './errors.js';
export type {
  HealthComponentType,
  HealthCategory,
  InstitutionalHealthStatus,
  ReliabilityTrend,
  HealthScore,
  HealthSignalMetrics,
  HealthMaintenanceRecord,
  HealthObservation,
  HealthHistoryEntry,
  HealthProfile,
  HealthScoreWeights,
  HealthForecast,
  HealthAssessmentRecord,
  HealthExplanation,
  HealthTwinDimension,
  InstitutionalHealthDigitalTwin,
  HealthSignalProvider,
  HardwareHealthProvider,
  ResourceHealthProvider,
  WorkloadHealthProvider,
  PowerHealthProvider,
  ThermalHealthProvider,
  HealthProviders,
} from './types.js';
