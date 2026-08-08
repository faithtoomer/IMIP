import type { HardwareCategory } from '../../hardware_authority/src/index.js';

/** §13, extended with real cycle-back and any-stage-archival edges — a
 * continuously operating monitoring authority cannot honestly be one-shot
 * linear. See ADR-0019. */
export type PowerLifecycleStage = 'discovered' | 'profiled' | 'monitored' | 'analyzed' | 'optimized' | 'archived';

export type PowerHealthStatus = 'healthy' | 'degraded' | 'sensor-unavailable' | 'unknown';

/** 'measured' — a real sensor reading. 'derived' — computed from other real
 * readings (e.g. platform wall power summed from component draw). Never
 * fabricated data presented as either. */
export type PowerReadingSource = 'measured' | 'derived';

export interface PowerReading {
  deviceId: string;
  watts: number;
  source: PowerReadingSource;
  recordedAt: string;
}

/** §6 — every monitored device's Power Profile. The registry is authoritative. */
export interface PowerProfile {
  deviceId: string;
  deviceCategory: HardwareCategory;
  currentPowerWatts?: number;
  averagePowerWatts?: number;
  peakPowerWatts?: number;
  idlePowerWatts?: number;
  /** Sourced from IHIS's real, already-discovered rated power limit — never
   * re-discovered or guessed by IPIA. Honestly `undefined` when IHIS has no
   * rated power data for this device (e.g. CPU, ASIC). */
  maximumRatedPowerWatts?: number;
  lastUpdated: string;
  healthStatus: PowerHealthStatus;
  lifecycleStage: PowerLifecycleStage;
}

export type PowerBudgetScope = 'platform' | HardwareCategory | 'device';

/** §10 — a configurable power budget. */
export interface PowerBudgetDefinition {
  budgetId: string;
  scope: PowerBudgetScope;
  /** Required when scope === 'device'. */
  targetDeviceId?: string;
  limitWatts: number;
  createdAt: string;
}

export interface PowerBudgetStatus {
  budgetId: string;
  scope: PowerBudgetScope;
  targetDeviceId?: string;
  currentWatts: number;
  limitWatts: number;
  exceeded: boolean;
  evaluatedAt: string;
}

export type PricingModel = 'flat' | 'time-of-use';

/** §9 — every field real, sourced from ICMS's already-real `electricity.*`
 * config values (Phase 02) — IPIA is the first real consumer. */
export interface EnergyCostSnapshot {
  /** `undefined` — platform-wide. */
  deviceId?: string;
  periodStart: string;
  periodEnd: string;
  kwh: number;
  ratePerKwh: number;
  currency: string;
  totalCost: number;
  pricingModel: PricingModel;
}

/** §11 — descriptive metrics; decision authorities use them for optimization. */
export interface EfficiencyMetrics {
  deviceId: string;
  /** Real: IPIA's own measured watts / IHIS's real best-benchmark hash rate. */
  hashesPerWatt?: number;
  /** Honestly `undefined` unless a real `RevenueSource` is supplied — no
   * Mining Session or Profitability authority exists yet in this platform. */
  revenuePerKwh?: number;
  costPerAcceptedShare?: number;
  computedAt: string;
}

export type RecommendationType = 'reduce-power-limit' | 'increase-idle-timeout' | 'delay-until-off-peak' | 'switch-to-efficient-device';

/** §12 — advisory only. IPIA never executes a recommendation itself (Law 6). */
export interface PowerRecommendation {
  recommendationId: string;
  type: RecommendationType;
  deviceId?: string;
  message: string;
  supportingMeasurements: Record<string, unknown>;
  generatedAt: string;
}

/** §14 — the 9 named events. */
export const POWER_EVENTS = {
  ProfileCreated: 'PowerProfileCreated',
  UsageUpdated: 'PowerUsageUpdated',
  BudgetExceeded: 'PowerBudgetExceeded',
  BudgetRecovered: 'PowerBudgetRecovered',
  EfficiencyCalculated: 'EfficiencyCalculated',
  CostUpdated: 'CostUpdated',
  RecommendationGenerated: 'RecommendationGenerated',
  SensorUnavailable: 'PowerSensorUnavailable',
  HealthChanged: 'PowerHealthChanged',
} as const;

export type PowerEventName = (typeof POWER_EVENTS)[keyof typeof POWER_EVENTS];

export interface PowerSensorReading {
  watts: number;
  recordedAt: string;
}

/** §7/Law 3 — a real, per-category telemetry source. Functional today for
 * GPU (`systeminformation`'s real, live `powerDraw`, distinct from IHIS's
 * own rated-power `powerLimit`); CPU/ASIC are real, honest, zero-producer
 * extension points — no cross-platform CPU package-power or ASIC power
 * reading exists in this platform's dependencies today. See ADR-0019. */
export interface PowerSensorProvider {
  readonly category: HardwareCategory;
  read(deviceId: string): Promise<PowerSensorReading | undefined>;
}

/** Real, honest extension point for revenue/share data. No Mining Session or
 * Profitability authority exists yet (both remain reserved `DataDomain`
 * values with no producer) — revenue-based efficiency metrics stay
 * `undefined` until a real source is supplied, never fabricated. */
export interface RevenueSource {
  revenuePerKwh(deviceId: string): number | undefined;
  costPerAcceptedShare(deviceId: string): number | undefined;
}

export interface PowerGovernanceMetrics {
  deviceCount: number;
  budgetCount: number;
  budgetExceededCount: number;
  recommendationCount: number;
  sensorUnavailableCount: number;
  averageTelemetryLatencyMs: number;
}

/** §15 — everything an explainable power assessment must expose. */
export interface PowerExplanation {
  profile: PowerProfile;
  history: PowerReading[];
  cost?: EnergyCostSnapshot;
  efficiency?: EfficiencyMetrics;
  budgets: PowerBudgetStatus[];
  recommendations: PowerRecommendation[];
}
