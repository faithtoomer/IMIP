import { randomUUID } from 'node:crypto';
import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { assembleInstitutionalHealthDigitalTwin } from './digitalTwin.js';
import { HealthValidationError } from './errors.js';
import { HEALTH_EVENTS, HealthEventBus, type HealthEventName } from './events.js';
import { HealthAuditTrail, explainHealth } from './explainability.js';
import { computeHealthForecast } from './forecast.js';
import { collectHealthProviders } from './providers.js';
import { HealthRegistry } from './registry.js';
import { computeHealthScore, mergeHealthScoreWeights } from './scoring.js';
import type {
  HealthAssessmentRecord,
  HealthExplanation,
  HealthForecast,
  HealthObservation,
  HealthProfile,
  HealthProviders,
  HealthScoreWeights,
  InstitutionalHealthDigitalTwin,
} from './types.js';

export interface HealthAuthorityOptions {
  providers?: HealthProviders;
  weights?: Partial<HealthScoreWeights>;
  eventBus?: InstitutionalEventBus;
  now?: () => string;
}

/**
 * IHIA — Institutional Health Intelligence Authority (PHASE-20).
 *
 * Pipeline: injected published signals → generic registry/profile → configurable
 * score → advisory forecast/IHDT → event and explainability surfaces. It owns no
 * component-specific health detector, allocation, runtime, scheduling, or mining action.
 */
export class HealthAuthority {
  readonly registry = new HealthRegistry();
  readonly audit = new HealthAuditTrail();
  readonly events: HealthEventBus;

  private readonly providers: HealthProviders;
  private readonly nowFn: () => string;
  private weights: HealthScoreWeights;

  constructor(options: HealthAuthorityOptions = {}) {
    this.providers = options.providers ?? {};
    this.weights = mergeHealthScoreWeights(options.weights);
    this.events = new HealthEventBus(options.eventBus);
    this.nowFn = options.now ?? (() => new Date().toISOString());
  }

  /** Refreshes only through injected provider contracts; no authority class is imported or instantiated. */
  refresh(): HealthProfile[] {
    return collectHealthProviders(this.providers).flatMap((provider) => provider.getHealthSignals()).map((observation) => this.assess(observation));
  }

  assess(observation: HealthObservation): HealthProfile {
    this.validateObservation(observation);
    const now = this.now();
    const previous = this.registry.get(observation.componentType, observation.componentId, observation.providerSource);
    const score = computeHealthScore(observation.metrics, this.weights);
    const historicalHealth = [
      ...(previous?.historicalHealth ?? []),
      { observedAt: observation.observedAt, score, evidence: [...(observation.evidence ?? [])], providerSource: observation.providerSource },
    ];
    const profile: HealthProfile = {
      profileId: previous?.profileId ?? randomUUID(),
      componentId: observation.componentId,
      componentType: observation.componentType,
      providerSource: observation.providerSource,
      categories: uniqueSorted(observation.categories),
      currentHealth: score,
      historicalHealth,
      failureCount: observation.failureCount ?? previous?.failureCount ?? 0,
      mtbfHours: observation.mtbfHours ?? previous?.mtbfHours,
      availabilityPercent: observation.availabilityPercent ?? score.availabilityScore,
      reliabilityTrend: observation.reliabilityTrend ?? previous?.reliabilityTrend ?? 'unknown',
      lastInspection: observation.lastInspection ?? previous?.lastInspection ?? observation.observedAt,
      maintenanceHistory: [...(previous?.maintenanceHistory ?? []), ...(observation.maintenanceHistory ?? [])],
      evidence: [...(observation.evidence ?? [])],
      createdAt: previous?.createdAt ?? now,
      lastUpdated: now,
    };
    this.registry.upsert(profile);
    const record: HealthAssessmentRecord = {
      timestamp: now,
      profileId: profile.profileId,
      registryKey: HealthRegistry.keyFor(profile.componentType, profile.componentId, profile.providerSource),
      kind: 'assessed',
      reason: `Published health signal assessed from ${profile.providerSource}.`,
      evidence: [...profile.evidence],
      previousScore: previous?.currentHealth,
      currentScore: score,
    };
    this.audit.record(record);
    this.publishAssessmentEvents(profile, previous);
    return profile;
  }

  getProfile(componentType: HealthObservation['componentType'], componentId: string, providerSource: string): HealthProfile {
    return this.registry.require(componentType, componentId, providerSource);
  }

  getForecast(componentType: HealthObservation['componentType'], componentId: string, providerSource: string): HealthForecast {
    return computeHealthForecast(this.getProfile(componentType, componentId, providerSource), this.now());
  }

  explain(componentType: HealthObservation['componentType'], componentId: string, providerSource: string): HealthExplanation {
    const profile = this.getProfile(componentType, componentId, providerSource);
    return explainHealth(profile, this.audit.forProfile(profile.profileId), computeHealthForecast(profile, this.now()));
  }

  getDigitalTwin(): InstitutionalHealthDigitalTwin {
    const profiles = this.registry.all();
    return assembleInstitutionalHealthDigitalTwin({
      profiles,
      forecasts: profiles.map((profile) => computeHealthForecast(profile, this.now())),
      now: this.now(),
    });
  }

  getWeights(): HealthScoreWeights {
    return { ...this.weights };
  }

  /** An explicit configuration seam; a composition root may update this from Configuration Authority without direct coupling. */
  setWeights(overrides: Partial<HealthScoreWeights>, reason = 'Health scoring configuration updated.'): HealthScoreWeights {
    this.weights = mergeHealthScoreWeights({ ...this.weights, ...overrides });
    this.audit.record({
      timestamp: this.now(), profileId: 'institutional-health', registryKey: 'institutional-health', kind: 'weights-updated', reason, evidence: [],
    });
    return this.getWeights();
  }

  subscribe(event: HealthEventName, handler: (payload: unknown) => void): () => void {
    return this.events.subscribe(event, handler);
  }

  private publishAssessmentEvents(profile: HealthProfile, previous?: HealthProfile): void {
    const forecast = computeHealthForecast(profile, this.now());
    const payload = { profile, forecast, advisory: true as const };
    this.events.publish(HEALTH_EVENTS.HealthUpdated, payload);
    if (profile.currentHealth.status === 'critical') this.events.publish(HEALTH_EVENTS.HealthCritical, payload);
    else if (profile.currentHealth.status === 'warning') this.events.publish(HEALTH_EVENTS.HealthWarning, payload);
    if (previous && previous.currentHealth.status !== 'healthy' && profile.currentHealth.status === 'healthy') {
      this.events.publish(HEALTH_EVENTS.HealthRecovered, payload);
    }
    if (forecast.expectedFailure) this.events.publish(HEALTH_EVENTS.FailurePredicted, payload);
    if (previous && previous.currentHealth.reliabilityScore !== profile.currentHealth.reliabilityScore) {
      this.events.publish(HEALTH_EVENTS.ReliabilityUpdated, payload);
    }
    if (previous && previous.currentHealth.overallScore !== profile.currentHealth.overallScore) {
      this.events.publish(HEALTH_EVENTS.HealthScoreChanged, payload);
    }
  }

  private validateObservation(observation: HealthObservation): void {
    if (!observation.componentId.trim()) throw new HealthValidationError('Health observation componentId is required.');
    if (!observation.providerSource.trim()) throw new HealthValidationError('Health observation providerSource is required.');
    if (!observation.observedAt || Number.isNaN(Date.parse(observation.observedAt))) {
      throw new HealthValidationError('Health observation observedAt must be a valid ISO timestamp.');
    }
    if (observation.categories.length === 0) throw new HealthValidationError('At least one health category is required.');
    for (const value of [observation.failureCount, observation.mtbfHours, observation.availabilityPercent]) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new HealthValidationError('Failure count, MTBF, and availability must be non-negative finite values.');
      }
    }
    if (observation.availabilityPercent !== undefined && observation.availabilityPercent > 100) {
      throw new HealthValidationError('Availability percentage must not exceed 100.');
    }
  }

  private now(): string {
    return this.nowFn();
  }
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort();
}
