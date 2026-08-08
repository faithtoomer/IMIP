export { ThermalAuthority, type ThermalAuthorityOptions } from './ThermalAuthority.js';
export { ThermalRegistry } from './registry.js';
export {
  InjectableThermalSensorProvider,
  type ThermalSensorProvider,
  type ThermalSensorOutcome,
} from './sensors.js';
export {
  NullPowerSnapshotProvider,
  MapPowerSnapshotProvider,
  type PowerSnapshotProvider,
} from './powerBridge.js';
export {
  BudgetManager,
  createDefaultBudget,
  DEFAULT_BUDGET_PRESETS,
  validateBudget,
  type BudgetPreset,
} from './budgets.js';
export { computeTrend, linearRegressionSlope } from './trends.js';
export { generateForecast, type ForecastInput } from './forecast.js';
export { detectAnomalies, resetAnomalyCounter, type AnomalyDetectionInput } from './anomaly.js';
export { generateRecommendations, resetRecommendationCounter, type RecommendationInput } from './recommendations.js';
export {
  validateTemperature,
  diagnoseProfile,
  checkSensorDrift,
  resolveThermalState,
  type DiagnosticResult,
} from './diagnostics.js';
export { ThermalHistoryStore, computeHistorySummary, type HistoryQuery } from './history.js';
export {
  THERMAL_LIFECYCLE_TRANSITIONS,
  assertThermalLifecycleTransition,
  canAdvanceLifecycle,
} from './lifecycle.js';
export {
  assembleDigitalTwin,
  devicesNearingWarning,
  estimateThermalImpactOfPowerReduction,
  degradationCandidates,
  platformThermalSummary,
  type DigitalTwinInput,
  type PlatformThermalSummary,
} from './digitalTwin.js';
export { THERMAL_EVENTS, ThermalEventBus, type ThermalEventName } from './events.js';
export { ThermalAuditTrail } from './explainability.js';
export { MetricsCollector } from './metrics.js';
export {
  ThermalError,
  ThermalNotFoundError,
  ThermalLifecycleError,
  ThermalSensorError,
  ThermalDiagnosticError,
  ThermalBudgetError,
  ThermalForecastError,
} from './errors.js';
export type {
  ThermalDomain,
  ThermalState,
  ThermalLifecycleStage,
  ThermalProfile,
  ThermalBudget,
  ThermalTrend,
  ThermalForecast,
  ThermalAnomaly,
  ThermalAnomalyKind,
  ThermalRecommendation,
  ThermalSample,
  ThermalHistoryPoint,
  ThermalAssessment,
  ThermalAuditRecord,
  ThermalMetrics,
  ThermalDigitalTwin,
  PowerSnapshotForThermal,
} from './types.js';
