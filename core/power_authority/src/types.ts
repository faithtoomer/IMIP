export type PowerDomain = 'cpu' | 'gpu' | 'asic' | 'system';

export type PowerHealthStatus = 'healthy' | 'degraded' | 'faulted' | 'unknown';

export type PowerLifecycleStage =
  | 'discovered'
  | 'profiled'
  | 'monitored'
  | 'analyzed'
  | 'optimized'
  | 'archived';

export type BudgetScope = 'platform' | 'gpu' | 'cpu' | 'rack' | 'fleet';

export type BillingModel = 'flat' | 'time-of-use';

export type EfficiencyTrend = 'improving' | 'stable' | 'declining' | 'unknown';

export interface EfficiencyMetrics {
  hashesPerWatt?: number;
  sharesPerKwh?: number;
  revenuePerKwh?: number;
  costPerAcceptedShare?: number;
  trend: EfficiencyTrend;
}

export interface ElectricityPricing {
  ratePerKwh: number;
  currency: string;
  billingModel: BillingModel;
  peakRate?: number;
  offPeakRate?: number;
  isPeak?: boolean;
}

export interface CostProfile {
  ratePerKwh: number;
  costPerHour: number;
  costPerDay: number;
  sessionCost?: number;
  currency: string;
  billingModel: BillingModel;
  pricingWindow: 'peak' | 'off-peak' | 'flat';
}

export interface PowerProfile {
  deviceId: string;
  deviceType: PowerDomain;
  currentWatts: number;
  averageWatts: number;
  peakWatts: number;
  idleWatts: number;
  maximumRatedWatts: number;
  efficiencyProfile: EfficiencyMetrics;
  costProfile: CostProfile;
  healthStatus: PowerHealthStatus;
  lifecycleStage: PowerLifecycleStage;
  lastUpdated: string;
  sensorAvailable: boolean;
}

export interface PowerBudget {
  id: string;
  scope: BudgetScope;
  limitWatts: number;
  currentWatts: number;
  exceeded: boolean;
}

export interface PowerRecommendation {
  id: string;
  deviceId?: string;
  action: string;
  rationale: string;
  supportingMeasurements: Record<string, unknown>;
  generatedAt: string;
  advisory: true;
}

export interface PowerSample {
  deviceId: string;
  watts: number;
  timestamp: string;
  sensorAvailable: boolean;
  maximumRatedWatts?: number;
}

export interface PowerHistoryPoint {
  deviceId: string;
  watts: number;
  timestamp: string;
}

export interface WorkloadTelemetry {
  hashesPerSecond?: number;
  acceptedShares?: number;
  revenuePerHour?: number;
}

export interface PowerAssessment {
  deviceId: string;
  profile: PowerProfile;
  measuredValues: {
    currentWatts: number;
    averageWatts: number;
    peakWatts: number;
    idleWatts: number;
  };
  trend: EfficiencyTrend;
  cost: CostProfile;
  efficiency: EfficiencyMetrics;
  budgetStatus: PowerBudget[];
  recommendations: PowerRecommendation[];
  supportingMeasurements: Record<string, unknown>;
  generatedAt: string;
}

export interface PowerAuditRecord {
  timestamp: string;
  deviceId: string;
  kind:
    | 'profile-created'
    | 'usage-updated'
    | 'budget-exceeded'
    | 'budget-recovered'
    | 'efficiency-calculated'
    | 'cost-updated'
    | 'recommendation-generated'
    | 'sensor-unavailable'
    | 'health-changed'
    | 'lifecycle-transition';
  details: Record<string, unknown>;
  reason?: string;
  initiatingAuthority?: string;
}

export interface PowerMetrics {
  telemetryLatencyMs: number[];
  registryUpdateCount: number;
  recommendationGenerationMs: number[];
  historicalQueryMs: number[];
  sensorAvailabilityRate: number;
  calculationLatencyMs: number[];
}

/** Architect's Enhancement — Institutional Energy Digital Twin (IEDT). */
export interface EnergyDigitalTwin {
  deviceId: string;
  profile: PowerProfile;
  historyTrend: EfficiencyTrend;
  pricing: ElectricityPricing;
  efficiency: EfficiencyMetrics;
  cost: CostProfile;
  budgets: PowerBudget[];
  recommendations: PowerRecommendation[];
}
