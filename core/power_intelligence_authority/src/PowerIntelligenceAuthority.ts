import { randomUUID } from 'node:crypto';
import type { HardwareAuthority, HardwareCategory } from '../../hardware_authority/src/index.js';
import type { ConfigurationAuthority } from '../../configuration_authority/src/index.js';
import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import type { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import type { DataAuthority } from '../../data_authority/src/index.js';
import { PowerRegistry } from './registry.js';
import { PowerTelemetryCollector } from './telemetryCollector.js';
import { CostEngine } from './costEngine.js';
import { EfficiencyEngine } from './efficiencyEngine.js';
import { PowerBudgetManager } from './budgetManager.js';
import { generateRecommendations } from './recommendationEngine.js';
import { InstitutionalEnergyDigitalTwin } from './energyDigitalTwin.js';
import { PowerAuditTrail } from './auditTrail.js';
import { PowerEventBus } from './events.js';
import { assertPowerLifecycleTransition } from './lifecycle.js';
import { POWER_EVENTS } from './types.js';
import type {
  EfficiencyMetrics,
  EnergyCostSnapshot,
  PowerBudgetDefinition,
  PowerBudgetScope,
  PowerBudgetStatus,
  PowerExplanation,
  PowerGovernanceMetrics,
  PowerProfile,
  PowerReading,
  PowerRecommendation,
  PowerSensorProvider,
  RevenueSource,
} from './types.js';

export interface PowerIntelligenceAuthorityOptions {
  hardwareAuthority: HardwareAuthority;
  configurationAuthority: ConfigurationAuthority;
  eventBus?: InstitutionalEventBus;
  observabilityAuthority?: ObservabilityAuthority;
  dataAuthority?: DataAuthority;
  sensorProviders?: PowerSensorProvider[];
  revenueSource?: RevenueSource;
  now?: () => Date;
}

const LOG_CATEGORY = 'power';
const SELF_AUTHORITY = 'Power Intelligence Authority';

/**
 * IPIA — the Institutional Power Intelligence Authority (PHASE-16), Program
 * III's first phase. The sole authority for power monitoring, cost,
 * efficiency, budgeting, and explainable, advisory-only recommendation.
 * `hardwareAuthority` and `configurationAuthority` are required (not
 * optional, unlike every other cross-cutting authority's integrations) —
 * without real device data and real electricity pricing there is nothing
 * genuinely measurable to report (Law 3). See ADR-0019.
 */
export class PowerIntelligenceAuthority {
  readonly registry = new PowerRegistry();
  readonly telemetry: PowerTelemetryCollector;
  readonly cost: CostEngine;
  readonly efficiency: EfficiencyEngine;
  readonly budgets = new PowerBudgetManager();
  readonly twin: InstitutionalEnergyDigitalTwin;
  readonly audit = new PowerAuditTrail();
  readonly events: PowerEventBus;

  private readonly hardwareAuthority: HardwareAuthority;
  private readonly observability?: ObservabilityAuthority;
  private readonly now: () => Date;
  private readonly lastBudgetExceeded = new Map<string, boolean>();
  private readonly recommendations: PowerRecommendation[] = [];

  private budgetExceededCount = 0;
  private recommendationCount = 0;
  private sensorUnavailableCount = 0;
  private readonly telemetryLatenciesMs: number[] = [];

  constructor(options: PowerIntelligenceAuthorityOptions) {
    this.hardwareAuthority = options.hardwareAuthority;
    this.observability = options.observabilityAuthority;
    this.now = options.now ?? (() => new Date());
    this.events = new PowerEventBus(options.eventBus);
    this.telemetry = new PowerTelemetryCollector(options.dataAuthority);
    this.cost = new CostEngine(options.configurationAuthority);
    this.efficiency = new EfficiencyEngine(this.hardwareAuthority, options.revenueSource);
    this.twin = new InstitutionalEnergyDigitalTwin(
      () => this.registry.all(),
      (deviceId, since) => this.telemetry.history(deviceId, since),
      this.cost,
      this.efficiency,
    );

    if (options.dataAuthority && !options.dataAuthority.schemas.has('power-history')) {
      options.dataAuthority.registerDomainSchema({
        domain: 'power-history',
        version: 1,
        fields: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'watts', type: 'number', required: true },
          { name: 'source', type: 'string', required: true },
          { name: 'recordedAt', type: 'timestamp', required: true },
        ],
      });
    }

    for (const provider of options.sensorProviders ?? []) this.telemetry.registerProvider(provider);

    if (this.observability) {
      if (!this.observability.categories.has(LOG_CATEGORY)) this.observability.registerCategory(LOG_CATEGORY);
      for (const name of Object.values(POWER_EVENTS)) {
        if (!this.observability.schemas.get(LOG_CATEGORY, name)) {
          this.observability.registerSchema({ category: LOG_CATEGORY, operation: name, description: `IPIA event: ${name}` });
        }
      }
    }
  }

  registerSensorProvider(provider: PowerSensorProvider): void {
    this.telemetry.registerProvider(provider);
  }

  setRevenueSource(source: RevenueSource): void {
    this.efficiency.setRevenueSource(source);
  }

  // ---- Power Registry / lifecycle (§6, §13) ----

  /** Creates a Power Profile from IHIS's real, already-discovered device
   * data — rated power comes from IHIS's real `powerLimitWatts`, never
   * re-discovered. Auto-transitions `discovered -> profiled`, mirroring
   * `registerVersion()`'s `created -> registered` pattern (IVGMA). */
  profileDevice(deviceId: string): PowerProfile {
    const device = this.hardwareAuthority.getDevice(deviceId);
    const maximumRatedPowerWatts = (device.categoryInfo as { powerLimitWatts?: number }).powerLimitWatts;

    const profile: PowerProfile = {
      deviceId,
      deviceCategory: device.category,
      maximumRatedPowerWatts,
      lastUpdated: this.now().toISOString(),
      healthStatus: 'unknown',
      lifecycleStage: 'discovered',
    };
    this.registry.register(profile);
    assertPowerLifecycleTransition('discovered', 'profiled');
    profile.lifecycleStage = 'profiled';
    this.registry.update(profile);
    this.audit.recordProfile(profile);
    this.publish(POWER_EVENTS.ProfileCreated, { deviceId, deviceCategory: device.category, maximumRatedPowerWatts });
    return profile;
  }

  /** Profiles every real IHIS device not already tracked — the power
   * equivalent of IVGMA's `syncVersions()`. */
  profileAllDevices(): PowerProfile[] {
    const created: PowerProfile[] = [];
    for (const device of this.hardwareAuthority.getInventory()) {
      if (this.registry.has(device.deviceId)) continue;
      created.push(this.profileDevice(device.deviceId));
    }
    return created;
  }

  /** §7/§8 — samples the device's real sensor provider (if registered for
   * its category), updates the Power Profile's real statistics, and
   * persists the reading. Honestly publishes `PowerSensorUnavailable` and
   * leaves wattage fields untouched when no real provider/reading exists —
   * never fabricates a value. */
  async sampleDevice(deviceId: string): Promise<PowerProfile> {
    const profile = this.registry.require(deviceId);
    const start = performance.now();
    const reading = await this.telemetry.sample(deviceId, profile.deviceCategory);
    this.telemetryLatenciesMs.push(performance.now() - start);

    if (!reading) {
      const updated: PowerProfile = { ...profile, healthStatus: 'sensor-unavailable', lastUpdated: this.now().toISOString() };
      this.registry.update(updated);
      this.audit.recordProfile(updated);
      this.sensorUnavailableCount += 1;
      this.publish(POWER_EVENTS.SensorUnavailable, { deviceId, category: profile.deviceCategory });
      return updated;
    }

    this.telemetry.record(deviceId, reading.watts, 'measured', reading.recordedAt);
    const history = this.telemetry.history(deviceId);
    const average = history.reduce((sum, r) => sum + r.watts, 0) / history.length;
    const peak = Math.max(reading.watts, profile.peakPowerWatts ?? 0);
    const runtimeState = this.hardwareAuthority.getState(deviceId);
    const idlePowerWatts = runtimeState === 'available' ? reading.watts : profile.idlePowerWatts;

    let lifecycleStage = profile.lifecycleStage;
    if (lifecycleStage === 'profiled') {
      assertPowerLifecycleTransition('profiled', 'monitored');
      lifecycleStage = 'monitored';
    }

    const updated: PowerProfile = {
      ...profile,
      currentPowerWatts: reading.watts,
      averagePowerWatts: average,
      peakPowerWatts: peak,
      idlePowerWatts,
      lastUpdated: this.now().toISOString(),
      healthStatus: 'healthy',
      lifecycleStage,
    };
    this.registry.update(updated);
    this.audit.recordProfile(updated);
    this.publish(POWER_EVENTS.UsageUpdated, { deviceId, watts: reading.watts });
    return updated;
  }

  /** Marks a device archived — reachable from any active lifecycle stage
   * (a device can be removed from the fleet at any point). */
  archiveDevice(deviceId: string): PowerProfile {
    const profile = this.registry.require(deviceId);
    assertPowerLifecycleTransition(profile.lifecycleStage, 'archived');
    const updated: PowerProfile = { ...profile, lifecycleStage: 'archived', lastUpdated: this.now().toISOString() };
    this.registry.update(updated);
    this.audit.recordProfile(updated);
    return updated;
  }

  getPowerProfile(deviceId: string): PowerProfile {
    return this.registry.require(deviceId);
  }

  getAllProfiles(): PowerProfile[] {
    return this.registry.all();
  }

  getHistory(deviceId: string, since?: string): PowerReading[] {
    return this.telemetry.history(deviceId, since);
  }

  // ---- Cost / efficiency (§9, §11) ----

  computeCost(deviceId: string | undefined, hours: number, at: Date = this.now()): EnergyCostSnapshot {
    const watts = deviceId ? (this.registry.require(deviceId).currentPowerWatts ?? 0) : this.totalCurrentWatts();
    const snapshot = this.cost.computeCost(deviceId, watts, hours, at);
    this.publish(POWER_EVENTS.CostUpdated, { deviceId, totalCost: snapshot.totalCost, kwh: snapshot.kwh });
    return snapshot;
  }

  computeEfficiency(deviceId: string): EfficiencyMetrics {
    const profile = this.registry.require(deviceId);
    const metrics = this.efficiency.compute(deviceId, profile.currentPowerWatts, this.now());
    this.publish(POWER_EVENTS.EfficiencyCalculated, { deviceId, hashesPerWatt: metrics.hashesPerWatt });
    return metrics;
  }

  private totalCurrentWatts(): number {
    return this.registry.all().reduce((sum, profile) => sum + (profile.currentPowerWatts ?? 0), 0);
  }

  // ---- Budgets (§10) ----

  defineBudget(input: { scope: PowerBudgetScope; targetDeviceId?: string; limitWatts: number }): PowerBudgetDefinition {
    return this.budgets.define({ budgetId: randomUUID(), ...input, createdAt: this.now().toISOString() });
  }

  private scopedCurrentWatts(scope: PowerBudgetScope, targetDeviceId?: string): number {
    if (scope === 'platform') return this.totalCurrentWatts();
    if (scope === 'device') return targetDeviceId ? (this.registry.get(targetDeviceId)?.currentPowerWatts ?? 0) : 0;
    return this.registry
      .all()
      .filter((profile) => profile.deviceCategory === (scope as HardwareCategory))
      .reduce((sum, profile) => sum + (profile.currentPowerWatts ?? 0), 0);
  }

  checkBudgets(at: Date = this.now()): PowerBudgetStatus[] {
    return this.budgets.all().map((budget) => {
      const currentWatts = this.scopedCurrentWatts(budget.scope, budget.targetDeviceId);
      const status = this.budgets.evaluate(budget, currentWatts, at);
      this.audit.recordBudgetStatus(status);

      const wasExceeded = this.lastBudgetExceeded.get(budget.budgetId) ?? false;
      if (status.exceeded && !wasExceeded) {
        this.budgetExceededCount += 1;
        this.publish(POWER_EVENTS.BudgetExceeded, { budgetId: budget.budgetId, currentWatts, limitWatts: budget.limitWatts });
      } else if (!status.exceeded && wasExceeded) {
        this.publish(POWER_EVENTS.BudgetRecovered, { budgetId: budget.budgetId, currentWatts, limitWatts: budget.limitWatts });
      }
      this.lastBudgetExceeded.set(budget.budgetId, status.exceeded);
      return status;
    });
  }

  // ---- Recommendations (§12) ----

  generateRecommendations(at: Date = this.now()): PowerRecommendation[] {
    const profiles = this.registry.all();
    const efficiencies = new Map<string, EfficiencyMetrics>();
    for (const profile of profiles) efficiencies.set(profile.deviceId, this.efficiency.compute(profile.deviceId, profile.currentPowerWatts, at));

    const runtimeStates = new Map(profiles.map((profile) => [profile.deviceId, this.hardwareAuthority.getState(profile.deviceId)]));
    const budgetStatuses = this.checkBudgets(at);
    const isOffPeakNow = this.cost.isCurrentlyOffPeak(at);

    for (const profile of profiles) {
      if (profile.lifecycleStage === 'monitored') {
        assertPowerLifecycleTransition('monitored', 'analyzed');
        this.registry.update({ ...profile, lifecycleStage: 'analyzed' });
      }
    }

    const recommendations = generateRecommendations({ profiles, efficiencies, budgetStatuses, runtimeStates, isOffPeakNow, now: at });

    const recommendedDeviceIds = new Set(recommendations.map((r) => r.deviceId).filter(Boolean));
    for (const profile of this.registry.all()) {
      if (profile.lifecycleStage !== 'analyzed') continue;
      const nextStage = recommendedDeviceIds.has(profile.deviceId) ? 'optimized' : 'monitored';
      assertPowerLifecycleTransition('analyzed', nextStage);
      this.registry.update({ ...profile, lifecycleStage: nextStage });
    }

    for (const recommendation of recommendations) {
      this.audit.recordRecommendation(recommendation);
      this.recommendations.push(recommendation);
      this.recommendationCount += 1;
      this.publish(POWER_EVENTS.RecommendationGenerated, { recommendationId: recommendation.recommendationId, type: recommendation.type, deviceId: recommendation.deviceId });
    }
    return recommendations;
  }

  getRecommendations(deviceId?: string): PowerRecommendation[] {
    return deviceId ? this.recommendations.filter((r) => r.deviceId === deviceId) : this.recommendations;
  }

  // ---- Explainability, metrics (§15, §18) ----

  explainPowerAssessment(deviceId: string): PowerExplanation {
    const profile = this.registry.require(deviceId);
    let cost: EnergyCostSnapshot | undefined;
    try {
      cost = this.computeCost(deviceId, 1, this.now());
    } catch {
      cost = undefined;
    }
    return {
      profile,
      history: this.telemetry.history(deviceId),
      cost,
      efficiency: this.efficiency.compute(deviceId, profile.currentPowerWatts, this.now()),
      budgets: this.checkBudgets(this.now()).filter((status) => status.targetDeviceId === deviceId || status.scope === 'platform' || status.scope === profile.deviceCategory),
      recommendations: this.audit.recommendationHistory(deviceId),
    };
  }

  getMetrics(): PowerGovernanceMetrics {
    return {
      deviceCount: this.registry.all().length,
      budgetCount: this.budgets.all().length,
      budgetExceededCount: this.budgetExceededCount,
      recommendationCount: this.recommendationCount,
      sensorUnavailableCount: this.sensorUnavailableCount,
      averageTelemetryLatencyMs: this.telemetryLatenciesMs.length === 0 ? 0 : this.telemetryLatenciesMs.reduce((sum, v) => sum + v, 0) / this.telemetryLatenciesMs.length,
    };
  }

  // ---- Internal ----

  private publish(name: (typeof POWER_EVENTS)[keyof typeof POWER_EVENTS], payload: unknown): void {
    this.events.publish(name, payload);
    this.logOnly(name, payload);
  }

  private logOnly(operation: string, payload: unknown): void {
    if (!this.observability) return;
    try {
      this.observability.log({
        severity: operation === POWER_EVENTS.BudgetExceeded || operation === POWER_EVENTS.SensorUnavailable ? 'warning' : 'information',
        category: LOG_CATEGORY,
        authority: SELF_AUTHORITY,
        operation,
        message: operation,
        context: payload as Record<string, unknown>,
      });
    } catch {
      // Observability is a diagnostic concern, never a functional dependency.
    }
  }
}
