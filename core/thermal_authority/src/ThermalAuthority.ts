import { ThermalRegistry } from './registry.js';
import { InjectableThermalSensorProvider, type ThermalSensorProvider } from './sensors.js';
import { NullPowerSnapshotProvider, type PowerSnapshotProvider } from './powerBridge.js';
import { BudgetManager } from './budgets.js';
import { computeTrend } from './trends.js';
import { generateForecast } from './forecast.js';
import { detectAnomalies } from './anomaly.js';
import { generateRecommendations } from './recommendations.js';
import { diagnoseProfile, resolveThermalState, validateTemperature } from './diagnostics.js';
import { ThermalHistoryStore } from './history.js';
import { assertThermalLifecycleTransition } from './lifecycle.js';
import { assembleDigitalTwin } from './digitalTwin.js';
import { THERMAL_EVENTS, ThermalEventBus, type ThermalEventName } from './events.js';
import { ThermalAuditTrail } from './explainability.js';
import { MetricsCollector } from './metrics.js';
import type {
  ThermalAnomaly,
  ThermalAssessment,
  ThermalBudget,
  ThermalDigitalTwin,
  ThermalForecast,
  ThermalHistoryPoint,
  ThermalLifecycleStage,
  ThermalMetrics,
  ThermalProfile,
  ThermalRecommendation,
  ThermalSample,
  ThermalTrend,
} from './types.js';

export interface ThermalAuthorityOptions {
  sensorProvider?: ThermalSensorProvider;
  powerProvider?: PowerSnapshotProvider;
}

/**
 * ITIA — the Institutional Thermal Intelligence Authority (PHASE-17).
 *
 * Pipeline: sensor collection → profile update → trend analysis → forecasting →
 * anomaly detection → advisory recommendations → digital twin assembly.
 * Never controls fans, clocks, or voltages.
 */
export class ThermalAuthority {
  readonly registry = new ThermalRegistry();
  readonly events = new ThermalEventBus();
  readonly audit = new ThermalAuditTrail();
  readonly budgets = new BudgetManager();
  readonly metrics = new MetricsCollector();

  private readonly sensorProvider: ThermalSensorProvider;
  private readonly powerProvider: PowerSnapshotProvider;
  private readonly history = new ThermalHistoryStore();
  private readonly anomalies = new Map<string, ThermalAnomaly[]>();
  private readonly recommendations = new Map<string, ThermalRecommendation[]>();
  private readonly forecasts = new Map<string, ThermalForecast>();
  private readonly trends = new Map<string, ThermalTrend>();
  private readonly previousProfiles = new Map<string, ThermalProfile>();

  constructor(options: ThermalAuthorityOptions = {}) {
    this.sensorProvider = options.sensorProvider ?? new InjectableThermalSensorProvider();
    this.powerProvider = options.powerProvider ?? new NullPowerSnapshotProvider();
  }

  registerDevice(
    deviceId: string,
    deviceType: ThermalProfile['deviceType'],
    idleCelsius?: number,
  ): ThermalProfile {
    const now = new Date().toISOString();
    const budget = this.budgets.getBudgetForDevice(deviceId, deviceType);
    const profile: ThermalProfile = {
      deviceId,
      deviceType,
      currentCelsius: 0,
      idleCelsius,
      thermalState: 'unknown',
      lifecycleStage: 'discovered',
      lastUpdated: now,
      sensorAvailable: false,
    };

    this.registry.upsert(profile);
    this.audit.record({
      timestamp: now,
      deviceId,
      kind: 'device-registered',
      details: { deviceType, idleCelsius },
      initiatingAuthority: 'Thermal Authority',
    });
    this.events.publish(THERMAL_EVENTS.ThermalProfileCreated, { deviceId, deviceType });
    this.advanceLifecycle(deviceId, 'profiled', 'device registered and profile initialized');

    return profile;
  }

  async collectAndUpdate(): Promise<ThermalProfile[]> {
    const outcome = await this.sensorProvider.collect();
    const now = new Date().toISOString();
    const updated: ThermalProfile[] = [];

    this.metrics.reset();

    for (const sample of outcome.samples) {
      const profile = this.processSample(sample, now);
      updated.push(profile);
    }

    for (const deviceId of outcome.unavailableDeviceIds ?? []) {
      const existing = this.registry.get(deviceId);
      if (existing) {
        const unavailable: ThermalProfile = {
          ...existing,
          sensorAvailable: false,
          thermalState: 'unknown',
          lastUpdated: now,
        };
        this.registry.upsert(unavailable);
        this.handleSensorUnavailable(deviceId, now);
        updated.push(unavailable);
      }
    }

    return updated;
  }

  getProfile(deviceId: string): ThermalProfile {
    return this.registry.require(deviceId);
  }

  getTrend(deviceId: string): ThermalTrend | null {
    return this.trends.get(deviceId) ?? null;
  }

  getForecast(deviceId: string): ThermalForecast | null {
    return this.forecasts.get(deviceId) ?? null;
  }

  getBudget(deviceId: string): ThermalBudget {
    const profile = this.registry.require(deviceId);
    return this.budgets.getBudgetForDevice(deviceId, profile.deviceType);
  }

  getRecommendations(deviceId: string): ThermalRecommendation[] {
    return this.recommendations.get(deviceId) ?? [];
  }

  getAnomalies(deviceId: string): ThermalAnomaly[] {
    return this.anomalies.get(deviceId) ?? [];
  }

  getAssessment(deviceId: string): ThermalAssessment {
    const twin = this.getDigitalTwin(deviceId);
    return twin.assessment;
  }

  getDigitalTwin(deviceId: string): ThermalDigitalTwin {
    const profile = this.registry.require(deviceId);
    const history = this.history.forDevice(deviceId);
    return assembleDigitalTwin({
      profile,
      trend: this.trends.get(deviceId) ?? null,
      forecast: this.forecasts.get(deviceId) ?? null,
      budget: this.budgets.getBudgetForDevice(deviceId, profile.deviceType),
      anomalies: this.anomalies.get(deviceId) ?? [],
      recommendations: this.recommendations.get(deviceId) ?? [],
      history,
      powerProvider: this.powerProvider,
    });
  }

  getHistory(deviceId: string, limit?: number): ThermalHistoryPoint[] {
    return this.history.query({ deviceId, limit });
  }

  setBudget(budget: ThermalBudget): void {
    this.budgets.setBudget(budget);
    this.audit.record({
      timestamp: new Date().toISOString(),
      deviceId: budget.scope,
      kind: 'budget-set',
      details: { budget },
      initiatingAuthority: 'Configuration Authority',
    });
  }

  setBudgetForDevice(deviceId: string, budget: ThermalBudget): void {
    this.budgets.setBudgetForDevice(deviceId, budget);
    this.audit.record({
      timestamp: new Date().toISOString(),
      deviceId,
      kind: 'budget-set',
      details: { budget },
      initiatingAuthority: 'Configuration Authority',
    });
  }

  getMetrics(): ThermalMetrics {
    return this.metrics.snapshot();
  }

  subscribe(event: ThermalEventName, handler: (payload: unknown) => void): () => void {
    return this.events.subscribe(event, handler);
  }

  private processSample(sample: ThermalSample, now: string): ThermalProfile {
    const previous = this.registry.get(sample.deviceId);
    const budget = this.budgets.getBudgetForDevice(sample.deviceId, sample.deviceType);

    if (sample.sensorAvailable) {
      validateTemperature(sample.celsius, sample.deviceId);
    }

    const thermalState = resolveThermalState(sample.celsius, budget, sample.sensorAvailable);

    const historyPoints = this.history.forDevice(sample.deviceId);
    const averageCelsius =
      historyPoints.length > 0
        ? (historyPoints.reduce((sum, p) => sum + p.celsius, 0) + sample.celsius) / (historyPoints.length + 1)
        : sample.celsius;

    const peakCelsius = Math.max(
      previous?.peakCelsius ?? sample.celsius,
      sample.celsius,
      ...historyPoints.map((p) => p.celsius),
    );
    const minCelsius = Math.min(
      previous?.minCelsius ?? sample.celsius,
      sample.celsius,
      ...historyPoints.map((p) => p.celsius),
    );

    const profile: ThermalProfile = {
      deviceId: sample.deviceId,
      deviceType: sample.deviceType,
      currentCelsius: sample.celsius,
      coreCelsius: sample.coreCelsius,
      memoryCelsius: sample.memoryCelsius,
      hotspotCelsius: sample.hotspotCelsius,
      vrmCelsius: sample.vrmCelsius,
      fanRpm: sample.fanRpm,
      ambientCelsius: sample.ambientCelsius,
      idleCelsius: previous?.idleCelsius,
      averageCelsius,
      peakCelsius,
      minCelsius,
      thermalState,
      lifecycleStage: previous?.lifecycleStage ?? 'discovered',
      lastUpdated: now,
      sensorAvailable: sample.sensorAvailable,
    };

    const diagnostic = diagnoseProfile(profile);
    if (!diagnostic.valid) {
      this.audit.record({
        timestamp: now,
        deviceId: sample.deviceId,
        kind: 'anomaly-detected',
        details: { diagnosticIssues: diagnostic.issues },
        reason: 'diagnostic-failure',
      });
    }

    if (!previous) {
      this.advanceLifecycle(sample.deviceId, 'profiled', 'first sensor reading received');
      this.events.publish(THERMAL_EVENTS.ThermalProfileCreated, {
        deviceId: sample.deviceId,
        deviceType: sample.deviceType,
      });
    }

    const prevState = previous?.thermalState;
    this.registry.upsert(profile);
    this.previousProfiles.set(sample.deviceId, profile);

    if (sample.sensorAvailable) {
      this.history.append({
        deviceId: sample.deviceId,
        celsius: sample.celsius,
        fanRpm: sample.fanRpm,
        recordedAt: sample.collectedAt,
      });
    }

    this.budgets.updateCurrentCelsius(sample.deviceId, sample.celsius);
    this.metrics.recordProfile(profile);

    this.events.publish(THERMAL_EVENTS.TemperatureUpdated, {
      deviceId: sample.deviceId,
      celsius: sample.celsius,
      thermalState,
    });

    this.audit.record({
      timestamp: now,
      deviceId: sample.deviceId,
      kind: 'profile-updated',
      details: { celsius: sample.celsius, thermalState },
    });

    this.handleStateTransitions(sample.deviceId, prevState, thermalState, profile, budget, now);
    this.runAnalysis(sample.deviceId, profile, previous, now);

    return profile;
  }

  private handleStateTransitions(
    deviceId: string,
    prevState: ThermalProfile['thermalState'] | undefined,
    newState: ThermalProfile['thermalState'],
    profile: ThermalProfile,
    budget: ThermalBudget,
    now: string,
  ): void {
    if (prevState === newState) return;

    this.audit.record({
      timestamp: now,
      deviceId,
      kind: 'state-changed',
      details: { from: prevState, to: newState },
    });

    if (newState === 'warning') {
      this.events.publish(THERMAL_EVENTS.ThermalWarning, {
        deviceId,
        celsius: profile.currentCelsius,
        threshold: budget.warningThresholdCelsius,
      });
      this.metrics.recordBudgetViolation();
      this.events.publish(THERMAL_EVENTS.ThermalBudgetExceeded, {
        deviceId,
        level: 'warning',
        celsius: profile.currentCelsius,
        threshold: budget.warningThresholdCelsius,
      });
    }

    if (newState === 'critical') {
      this.events.publish(THERMAL_EVENTS.ThermalCritical, {
        deviceId,
        celsius: profile.currentCelsius,
        threshold: budget.criticalThresholdCelsius,
      });
      this.metrics.recordBudgetViolation();
      this.events.publish(THERMAL_EVENTS.ThermalBudgetExceeded, {
        deviceId,
        level: 'critical',
        celsius: profile.currentCelsius,
        threshold: budget.criticalThresholdCelsius,
      });
    }

    if (
      (prevState === 'warning' || prevState === 'critical') &&
      (newState === 'nominal' || newState === 'elevated')
    ) {
      this.events.publish(THERMAL_EVENTS.ThermalRecovered, { deviceId, celsius: profile.currentCelsius });
      this.audit.record({
        timestamp: now,
        deviceId,
        kind: 'recovered',
        details: { from: prevState, celsius: profile.currentCelsius },
      });
    }
  }

  private runAnalysis(
    deviceId: string,
    profile: ThermalProfile,
    previous: ThermalProfile | undefined,
    now: string,
  ): void {
    const history = this.history.forDevice(deviceId);
    const budget = this.budgets.getBudgetForDevice(deviceId, profile.deviceType);

    if (history.length >= 2) {
      const trend = computeTrend(history);
      this.trends.set(deviceId, trend);
      this.advanceLifecycle(deviceId, 'analyzed', 'trend analysis completed');

      const forecast = generateForecast({
        currentCelsius: profile.currentCelsius,
        trend,
        budget,
        generatedAt: now,
      });
      this.forecasts.set(deviceId, forecast);
      this.metrics.recordForecast();
      this.advanceLifecycle(deviceId, 'forecasted', 'forecast generated');
      this.events.publish(THERMAL_EVENTS.ThermalForecastGenerated, { deviceId, forecast });
      this.audit.record({
        timestamp: now,
        deviceId,
        kind: 'forecast-generated',
        details: { expectedCelsius: forecast.expectedCelsius },
      });
    }

    this.advanceLifecycle(deviceId, 'monitored', 'sensor data received');

    const detected = detectAnomalies({
      profile,
      history,
      previousProfile: previous,
      trend: this.trends.get(deviceId),
    });

    if (detected.length > 0) {
      this.anomalies.set(deviceId, detected);
      for (const anomaly of detected) {
        this.metrics.recordAnomaly();
        this.events.publish(THERMAL_EVENTS.ThermalAnomalyDetected, { deviceId, anomaly });
        this.audit.record({
          timestamp: now,
          deviceId,
          kind: 'anomaly-detected',
          details: { kind: anomaly.kind, severity: anomaly.severity },
        });
      }
    } else {
      this.anomalies.set(deviceId, []);
    }

    const recs = generateRecommendations({
      profile,
      budget,
      forecast: this.forecasts.get(deviceId) ?? null,
      trend: this.trends.get(deviceId) ?? null,
      anomalies: detected,
      generatedAt: now,
    });

    if (recs.length > 0) {
      this.recommendations.set(deviceId, recs);
      this.metrics.recordRecommendation(recs.length);
      this.advanceLifecycle(deviceId, 'recommended', 'advisory recommendations generated');
      for (const rec of recs) {
        this.events.publish(THERMAL_EVENTS.ThermalRecommendationGenerated, { deviceId, recommendation: rec });
        this.audit.record({
          timestamp: now,
          deviceId,
          kind: 'recommendation-generated',
          details: { action: rec.action },
        });
      }
    } else {
      this.recommendations.set(deviceId, []);
    }
  }

  private handleSensorUnavailable(deviceId: string, now: string): void {
    this.events.publish(THERMAL_EVENTS.ThermalSensorUnavailable, { deviceId });
    this.audit.record({
      timestamp: now,
      deviceId,
      kind: 'sensor-unavailable',
      details: {},
    });
  }

  private advanceLifecycle(deviceId: string, to: ThermalLifecycleStage, reason: string): void {
    const profile = this.registry.get(deviceId);
    if (!profile) return;

    const from = profile.lifecycleStage;
    if (from === to) return;

    try {
      assertThermalLifecycleTransition(from, to);
    } catch {
      return;
    }

    const updated: ThermalProfile = { ...profile, lifecycleStage: to, lastUpdated: new Date().toISOString() };
    this.registry.upsert(updated);
    this.audit.record({
      timestamp: updated.lastUpdated,
      deviceId,
      kind: 'lifecycle-transition',
      details: { from, to },
      reason,
      initiatingAuthority: 'Thermal Authority',
    });
  }
}
