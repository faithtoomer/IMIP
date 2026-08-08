import { PowerRegistry } from './registry.js';
import {
  InjectablePowerTelemetryProvider,
  type PowerTelemetryProvider,
} from './telemetry.js';
import {
  StaticElectricityPricingProvider,
  type ElectricityPricingProvider,
} from './pricing.js';
import { computeCostProfile, sessionCostFromWatts } from './cost.js';
import { computeEfficiency, computeEfficiencyTrend } from './efficiency.js';
import { BudgetManager } from './budget.js';
import { generateRecommendations } from './recommendations.js';
import { validateSample } from './diagnostics.js';
import { PowerHistoryStore } from './history.js';
import { assertLifecycleTransition } from './lifecycle.js';
import {
  assembleEnergyDigitalTwin,
  efficiencyTrendFromHistory,
  estimateCostImpactOfPowerReduction,
  platformEnergySummary,
  rankByRevenuePerKwh,
  type PlatformEnergySummary,
} from './digitalTwin.js';
import { POWER_EVENTS, PowerEventBus, type PowerEventName } from './events.js';
import { PowerAuditTrail } from './explainability.js';
import { MetricsCollector } from './metrics.js';
import { PowerNotFoundError } from './errors.js';
import type {
  BudgetScope,
  CostProfile,
  EfficiencyMetrics,
  ElectricityPricing,
  EnergyDigitalTwin,
  PowerAssessment,
  PowerBudget,
  PowerDomain,
  PowerHealthStatus,
  PowerLifecycleStage,
  PowerProfile,
  PowerRecommendation,
  PowerSample,
  WorkloadTelemetry,
} from './types.js';

export interface RegisterDeviceInput {
  deviceId: string;
  deviceType: PowerDomain;
  maximumRatedWatts: number;
  idleWatts?: number;
}

export interface PowerAuthorityOptions {
  telemetryProvider?: PowerTelemetryProvider;
  pricingProvider?: ElectricityPricingProvider;
}

const DEFAULT_PRICING: ElectricityPricing = {
  ratePerKwh: 0.12,
  currency: 'USD',
  billingModel: 'flat',
};

/**
 * IPIA — Institutional Power Intelligence Authority (PHASE-16).
 *
 * Pipeline: telemetry collection → diagnostics → registry update → cost/efficiency
 * calculation → budget evaluation → recommendation generation → event publication.
 * Every device is assembled into an Institutional Energy Digital Twin (IEDT).
 * Recommendations are advisory only — never modifies hardware power limits.
 */
export class PowerAuthority {
  readonly registry = new PowerRegistry();
  readonly events = new PowerEventBus();
  readonly audit = new PowerAuditTrail();
  readonly history = new PowerHistoryStore();
  readonly budgets = new BudgetManager();
  readonly metrics = new MetricsCollector();

  private readonly telemetryProvider: PowerTelemetryProvider;
  private readonly pricingProvider: ElectricityPricingProvider;
  private readonly workloadByDevice = new Map<string, WorkloadTelemetry>();
  private readonly recommendations: PowerRecommendation[] = [];
  private readonly peakWattsByDevice = new Map<string, number>();
  private readonly sampleCountByDevice = new Map<string, number>();
  private readonly wattSumByDevice = new Map<string, number>();

  constructor(options: PowerAuthorityOptions = {}) {
    this.telemetryProvider = options.telemetryProvider ?? new InjectablePowerTelemetryProvider();
    this.pricingProvider = options.pricingProvider ?? new StaticElectricityPricingProvider(DEFAULT_PRICING);
  }

  // ---- Device registration ----

  registerDevice(input: RegisterDeviceInput): PowerProfile {
    const now = new Date().toISOString();
    const pricing = this.pricingProvider.getPricing();
    const idleWatts = input.idleWatts ?? 0;
    const costProfile = computeCostProfile(idleWatts, pricing);

    const profile: PowerProfile = {
      deviceId: input.deviceId,
      deviceType: input.deviceType,
      currentWatts: idleWatts,
      averageWatts: idleWatts,
      peakWatts: idleWatts,
      idleWatts,
      maximumRatedWatts: input.maximumRatedWatts,
      efficiencyProfile: { trend: 'unknown' },
      costProfile,
      healthStatus: 'unknown',
      lifecycleStage: 'discovered',
      lastUpdated: now,
      sensorAvailable: false,
    };

    this.registry.upsert(profile);
    this.peakWattsByDevice.set(input.deviceId, idleWatts);
    this.sampleCountByDevice.set(input.deviceId, 0);
    this.wattSumByDevice.set(input.deviceId, 0);
    this.metrics.recordRegistryUpdate();

    this.audit.record({
      timestamp: now,
      deviceId: input.deviceId,
      kind: 'profile-created',
      details: { deviceType: input.deviceType, maximumRatedWatts: input.maximumRatedWatts },
      initiatingAuthority: 'Power Authority',
    });
    this.events.publish(POWER_EVENTS.ProfileCreated, { deviceId: input.deviceId, deviceType: input.deviceType });

    this.advanceLifecycle(input.deviceId, 'profiled', 'device registered with power profile', 'Power Authority');
    return profile;
  }

  // ---- Telemetry ingestion ----

  setWorkloadTelemetry(deviceId: string, telemetry: WorkloadTelemetry): void {
    this.registry.require(deviceId);
    this.workloadByDevice.set(deviceId, telemetry);
  }

  ingestTelemetry(sample: PowerSample): PowerProfile {
    const diagnostic = validateSample(sample);
    const now = sample.timestamp || new Date().toISOString();

    if (!diagnostic.valid) {
      this.audit.record({
        timestamp: now,
        deviceId: sample.deviceId,
        kind: 'sensor-unavailable',
        details: { errors: diagnostic.errors },
        reason: 'invalid-telemetry',
        initiatingAuthority: 'Power Authority',
      });
      throw new Error(diagnostic.errors.join(' '));
    }

    if (!sample.sensorAvailable) {
      return this.handleSensorUnavailable(sample, now, diagnostic.warnings);
    }

    return this.applySample(sample, now);
  }

  async collectAndUpdate(): Promise<PowerProfile[]> {
    const start = performance.now();
    const outcome = await this.telemetryProvider.collect();
    this.metrics.recordTelemetryLatency(performance.now() - start);

    const updated: PowerProfile[] = [];

    for (const failure of outcome.failures) {
      this.audit.record({
        timestamp: new Date().toISOString(),
        deviceId: failure.deviceId,
        kind: 'sensor-unavailable',
        details: { message: failure.message },
        reason: 'telemetry-collection-failure',
        initiatingAuthority: 'Power Authority',
      });
      this.events.publish(POWER_EVENTS.SensorUnavailable, { deviceId: failure.deviceId, message: failure.message });
      this.metrics.recordSensorOutcome(false);
    }

    for (const sample of outcome.samples) {
      this.metrics.recordSensorOutcome(sample.sensorAvailable);
      const diagnostic = validateSample(sample);
      if (!diagnostic.valid) {
        this.audit.record({
          timestamp: sample.timestamp,
          deviceId: sample.deviceId,
          kind: 'sensor-unavailable',
          details: { errors: diagnostic.errors },
          initiatingAuthority: 'Power Authority',
        });
        continue;
      }

      if (!sample.sensorAvailable) {
        updated.push(this.handleSensorUnavailable(sample, sample.timestamp, diagnostic.warnings));
        continue;
      }

      updated.push(this.applySample(sample, sample.timestamp));
    }

    this.evaluateBudgets();
    this.refreshRecommendations();
    return updated;
  }

  // ---- Budget APIs ----

  setBudget(id: string, scope: BudgetScope, limitWatts: number): PowerBudget {
    const currentWatts = this.computeScopeWatts(scope);
    return this.budgets.setBudget(id, scope, limitWatts, currentWatts);
  }

  getBudget(id: string): PowerBudget {
    const budget = this.budgets.getBudget(id);
    if (!budget) throw new PowerNotFoundError('Budget', id);
    return budget;
  }

  listBudgets(): PowerBudget[] {
    return this.budgets.all();
  }

  // ---- Read API (§16) ----

  getProfile(deviceId: string): PowerProfile {
    return this.registry.require(deviceId);
  }

  getCost(deviceId: string): CostProfile {
    return this.registry.require(deviceId).costProfile;
  }

  getEfficiency(deviceId: string): EfficiencyMetrics {
    return this.registry.require(deviceId).efficiencyProfile;
  }

  getHistory(deviceId: string) {
    const start = performance.now();
    const result = this.history.forDevice(deviceId);
    this.metrics.recordHistoricalQuery(performance.now() - start);
    return result;
  }

  getRecommendations(deviceId?: string): PowerRecommendation[] {
    if (deviceId) {
      return this.recommendations.filter((r) => !r.deviceId || r.deviceId === deviceId);
    }
    return [...this.recommendations];
  }

  getAssessment(deviceId: string): PowerAssessment {
    const profile = this.registry.require(deviceId);
    const calcStart = performance.now();

    const assessment: PowerAssessment = {
      deviceId,
      profile,
      measuredValues: {
        currentWatts: profile.currentWatts,
        averageWatts: profile.averageWatts,
        peakWatts: profile.peakWatts,
        idleWatts: profile.idleWatts,
      },
      trend: profile.efficiencyProfile.trend,
      cost: profile.costProfile,
      efficiency: profile.efficiencyProfile,
      budgetStatus: this.budgets.all().filter((b) => b.scope === profile.deviceType || b.scope === 'platform'),
      recommendations: this.getRecommendations(deviceId),
      supportingMeasurements: {
        sensorAvailable: profile.sensorAvailable,
        maximumRatedWatts: profile.maximumRatedWatts,
        lifecycleStage: profile.lifecycleStage,
        healthStatus: profile.healthStatus,
      },
      generatedAt: new Date().toISOString(),
    };

    this.metrics.recordCalculationLatency(performance.now() - calcStart);
    return assessment;
  }

  getDigitalTwin(deviceId: string): EnergyDigitalTwin {
    const profile = this.registry.require(deviceId);
    const pricing = this.pricingProvider.getPricing();
    const historyTrend = efficiencyTrendFromHistory(
      this.history,
      deviceId,
      this.workloadByDevice.get(deviceId)?.hashesPerSecond,
    );
    return assembleEnergyDigitalTwin(profile, pricing, this.budgets.all(), this.recommendations, historyTrend);
  }

  rankByRevenuePerKwh(): PowerProfile[] {
    return rankByRevenuePerKwh(this.registry.all());
  }

  estimateCostImpactOfPowerReduction(deviceId: string, reductionWatts: number) {
    const profile = this.registry.require(deviceId);
    return estimateCostImpactOfPowerReduction(profile, reductionWatts, this.pricingProvider.getPricing());
  }

  getPlatformEnergySummary(): PlatformEnergySummary {
    return platformEnergySummary(this.registry.all());
  }

  getEfficiencyTrend(deviceId: string) {
    return efficiencyTrendFromHistory(this.history, deviceId, this.workloadByDevice.get(deviceId)?.hashesPerSecond);
  }

  getPricing(): ElectricityPricing {
    return this.pricingProvider.getPricing();
  }

  sessionCost(deviceId: string, sessionHours: number): number {
    const profile = this.registry.require(deviceId);
    return sessionCostFromWatts(profile.averageWatts, sessionHours, this.pricingProvider.getPricing());
  }

  subscribe(event: PowerEventName, handler: (payload: unknown) => void): () => void {
    return this.events.subscribe(event, handler);
  }

  // ---- Internal helpers ----

  private handleSensorUnavailable(sample: PowerSample, now: string, warnings: string[]): PowerProfile {
    let profile = this.registry.get(sample.deviceId);
    if (!profile) {
      throw new PowerNotFoundError('Device power profile', sample.deviceId);
    }

    const previousHealth = profile.healthStatus;
    profile = {
      ...profile,
      sensorAvailable: false,
      healthStatus: 'degraded',
      lastUpdated: now,
    };
    this.registry.upsert(profile);

    this.audit.record({
      timestamp: now,
      deviceId: sample.deviceId,
      kind: 'sensor-unavailable',
      details: { warnings },
      initiatingAuthority: 'Power Authority',
    });
    this.events.publish(POWER_EVENTS.SensorUnavailable, { deviceId: sample.deviceId, warnings });

    if (previousHealth !== 'degraded') {
      this.updateHealth(sample.deviceId, 'degraded', 'sensor unavailable');
    }

    return profile;
  }

  private applySample(sample: PowerSample, now: string): PowerProfile {
    let profile = this.registry.get(sample.deviceId);
    if (!profile) {
      throw new PowerNotFoundError('Device power profile', sample.deviceId);
    }

    const count = (this.sampleCountByDevice.get(sample.deviceId) ?? 0) + 1;
    const wattSum = (this.wattSumByDevice.get(sample.deviceId) ?? 0) + sample.watts;
    const averageWatts = wattSum / count;
    const peakWatts = Math.max(this.peakWattsByDevice.get(sample.deviceId) ?? 0, sample.watts);

    this.sampleCountByDevice.set(sample.deviceId, count);
    this.wattSumByDevice.set(sample.deviceId, wattSum);
    this.peakWattsByDevice.set(sample.deviceId, peakWatts);

    const pricing = this.pricingProvider.getPricing();
    const costProfile = computeCostProfile(averageWatts, pricing);
    const workload = this.workloadByDevice.get(sample.deviceId);
    const previousEfficiency = profile.efficiencyProfile;
    const efficiency = computeEfficiency(averageWatts, workload, previousEfficiency.trend);

    if (previousEfficiency.hashesPerWatt !== undefined && efficiency.hashesPerWatt !== undefined) {
      efficiency.trend = computeEfficiencyTrend(efficiency.hashesPerWatt, previousEfficiency.hashesPerWatt);
    }

    const healthStatus = this.assessHealth(sample, profile);

    profile = {
      ...profile,
      currentWatts: sample.watts,
      averageWatts,
      peakWatts,
      efficiencyProfile: efficiency,
      costProfile,
      healthStatus,
      sensorAvailable: true,
      lastUpdated: now,
    };
    this.registry.upsert(profile);
    this.metrics.recordRegistryUpdate();

    this.history.append({ deviceId: sample.deviceId, watts: sample.watts, timestamp: now });

    this.audit.record({
      timestamp: now,
      deviceId: sample.deviceId,
      kind: 'usage-updated',
      details: { watts: sample.watts, averageWatts, peakWatts },
      initiatingAuthority: 'Power Authority',
    });
    this.events.publish(POWER_EVENTS.UsageUpdated, { deviceId: sample.deviceId, watts: sample.watts });

    this.audit.record({
      timestamp: now,
      deviceId: sample.deviceId,
      kind: 'cost-updated',
      details: { costProfile },
      initiatingAuthority: 'Power Authority',
    });
    this.events.publish(POWER_EVENTS.CostUpdated, { deviceId: sample.deviceId, costProfile });

    this.audit.record({
      timestamp: now,
      deviceId: sample.deviceId,
      kind: 'efficiency-calculated',
      details: { efficiency },
      initiatingAuthority: 'Power Authority',
    });
    this.events.publish(POWER_EVENTS.EfficiencyCalculated, { deviceId: sample.deviceId, efficiency });

    if (profile.lifecycleStage === 'profiled') {
      this.advanceLifecycle(sample.deviceId, 'monitored', 'telemetry received', 'Power Authority');
    }
    if (profile.lifecycleStage === 'monitored') {
      this.advanceLifecycle(sample.deviceId, 'analyzed', 'sufficient telemetry for analysis', 'Power Authority');
    }

    return profile;
  }

  private assessHealth(sample: PowerSample, profile: PowerProfile): PowerHealthStatus {
    const maxRated = sample.maximumRatedWatts ?? profile.maximumRatedWatts;
    if (maxRated > 0 && sample.watts > maxRated) return 'faulted';
    if (maxRated > 0 && sample.watts > maxRated * 0.9) return 'degraded';
    return 'healthy';
  }

  private updateHealth(deviceId: string, healthStatus: PowerHealthStatus, reason: string): void {
    const profile = this.registry.require(deviceId);
    if (profile.healthStatus === healthStatus) return;

    const now = new Date().toISOString();
    const updated: PowerProfile = { ...profile, healthStatus, lastUpdated: now };
    this.registry.upsert(updated);

    this.audit.record({
      timestamp: now,
      deviceId,
      kind: 'health-changed',
      details: { from: profile.healthStatus, to: healthStatus, reason },
      initiatingAuthority: 'Power Authority',
    });
    this.events.publish(POWER_EVENTS.HealthChanged, { deviceId, from: profile.healthStatus, to: healthStatus });
  }

  private computeScopeWatts(scope: BudgetScope): number {
    if (scope === 'platform' || scope === 'fleet' || scope === 'rack') {
      return this.registry.totalCurrentWatts();
    }
    return this.registry.byDomain(scope).reduce((sum, p) => sum + p.currentWatts, 0);
  }

  private evaluateBudgets(): void {
    const scopes: BudgetScope[] = ['platform', 'gpu', 'cpu', 'rack', 'fleet'];
    const wattsByScope: Partial<Record<BudgetScope, number>> = {};
    for (const scope of scopes) {
      wattsByScope[scope] = this.computeScopeWatts(scope);
    }

    for (const evaluation of this.budgets.evaluateAll(wattsByScope)) {
      if (evaluation.justExceeded) {
        this.audit.record({
          timestamp: new Date().toISOString(),
          deviceId: `__budget:${evaluation.budget.id}__`,
          kind: 'budget-exceeded',
          details: { budget: evaluation.budget },
          initiatingAuthority: 'Power Authority',
        });
        this.events.publish(POWER_EVENTS.BudgetExceeded, { budgetId: evaluation.budget.id, budget: evaluation.budget });
      }
      if (evaluation.justRecovered) {
        this.audit.record({
          timestamp: new Date().toISOString(),
          deviceId: `__budget:${evaluation.budget.id}__`,
          kind: 'budget-recovered',
          details: { budget: evaluation.budget },
          initiatingAuthority: 'Power Authority',
        });
        this.events.publish(POWER_EVENTS.BudgetRecovered, { budgetId: evaluation.budget.id, budget: evaluation.budget });
      }
    }
  }

  private refreshRecommendations(): void {
    const start = performance.now();
    const pricing = this.pricingProvider.getPricing();
    const recs = generateRecommendations(this.registry.all(), this.budgets.all(), pricing);

    for (const rec of recs) {
      const existing = this.recommendations.find((r) => r.action === rec.action && r.deviceId === rec.deviceId);
      if (!existing) {
        this.recommendations.push(rec);
        this.audit.record({
          timestamp: rec.generatedAt,
          deviceId: rec.deviceId ?? '__platform__',
          kind: 'recommendation-generated',
          details: { recommendation: rec },
          initiatingAuthority: 'Power Authority',
        });
        this.events.publish(POWER_EVENTS.RecommendationGenerated, rec);
      }
    }

    this.metrics.recordRecommendationGeneration(performance.now() - start);

    const analyzed = this.registry.all().filter((p) => p.lifecycleStage === 'analyzed');
    for (const profile of analyzed) {
      if (this.recommendations.some((r) => r.deviceId === profile.deviceId)) {
        this.advanceLifecycle(profile.deviceId, 'optimized', 'recommendations generated', 'Power Authority');
      }
    }
  }

  private advanceLifecycle(deviceId: string, to: PowerLifecycleStage, reason: string, initiatingAuthority: string): PowerProfile {
    const profile = this.registry.require(deviceId);
    assertLifecycleTransition(profile.lifecycleStage, to);
    const now = new Date().toISOString();
    const updated: PowerProfile = { ...profile, lifecycleStage: to, lastUpdated: now };
    this.registry.upsert(updated);

    this.audit.record({
      timestamp: now,
      deviceId,
      kind: 'lifecycle-transition',
      details: { from: profile.lifecycleStage, to },
      reason,
      initiatingAuthority,
    });

    return updated;
  }
}
