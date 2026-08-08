export { PowerAuthority, type PowerAuthorityOptions, type RegisterDeviceInput } from './PowerAuthority.js';
export { PowerRegistry } from './registry.js';
export {
  InjectablePowerTelemetryProvider,
  synthesizeSample,
  type PowerTelemetryProvider,
  type PowerTelemetryOutcome,
  type TelemetryFailure,
} from './telemetry.js';
export {
  StaticElectricityPricingProvider,
  resolveEffectiveRate,
  resolvePricingWindow,
  type ElectricityPricingProvider,
} from './pricing.js';
export { computeCostProfile, sessionCostFromWatts, wattsToKwh, wattHoursToKwh, costFromKwh } from './cost.js';
export { computeEfficiency, computeEfficiencyTrend } from './efficiency.js';
export { BudgetManager, type BudgetEvaluation } from './budget.js';
export { generateRecommendations, resetRecommendationCounter } from './recommendations.js';
export { validateSample, assertValidSample, isSensorUnavailable } from './diagnostics.js';
export { PowerHistoryStore, type HistoryQuery } from './history.js';
export { POWER_LIFECYCLE_TRANSITIONS, assertLifecycleTransition } from './lifecycle.js';
export {
  assembleEnergyDigitalTwin,
  rankByRevenuePerKwh,
  estimateCostImpactOfPowerReduction,
  platformEnergySummary,
  efficiencyTrendFromHistory,
  type PlatformEnergySummary,
} from './digitalTwin.js';
export { POWER_EVENTS, PowerEventBus, type PowerEventName } from './events.js';
export { PowerAuditTrail } from './explainability.js';
export { MetricsCollector } from './metrics.js';
export {
  PowerError,
  PowerNotFoundError,
  PowerInvalidTelemetryError,
  PowerBudgetError,
  PowerCostError,
  PowerLifecycleError,
} from './errors.js';
export type {
  PowerDomain,
  PowerHealthStatus,
  PowerLifecycleStage,
  BudgetScope,
  BillingModel,
  EfficiencyTrend,
  EfficiencyMetrics,
  ElectricityPricing,
  CostProfile,
  PowerProfile,
  PowerBudget,
  PowerRecommendation,
  PowerSample,
  PowerHistoryPoint,
  WorkloadTelemetry,
  PowerAssessment,
  PowerAuditRecord,
  PowerMetrics,
  EnergyDigitalTwin,
} from './types.js';
