import { randomUUID } from 'node:crypto';
import { WorkloadRegistry } from './registry.js';
import { WorkloadHistoryStore } from './history.js';
import { WorkloadAuditTrail, explainWorkload } from './explainability.js';
import { WorkloadEventBus, WORKLOAD_EVENTS, type WorkloadEventName } from './events.js';
import { assertWorkloadStateTransition } from './lifecycle.js';
import { assembleWorkloadDigitalTwin } from './digitalTwin.js';
import { computeWorkloadForecast } from './forecast.js';
import { NullResourceCandidateProvider } from './providers.js';
import {
  InvalidWorkloadPriorityError,
  WorkloadDependencyError,
  WorkloadValidationError,
} from './errors.js';
import type {
  AssignedResource,
  ResourceCandidateProvider,
  WorkloadAuditRecord,
  WorkloadBalanceRecommendation,
  WorkloadCreateRequest,
  WorkloadDigitalTwin,
  WorkloadExplanation,
  WorkloadForecast,
  WorkloadHistoryEntry,
  WorkloadPlacementRecommendation,
  WorkloadProfile,
  WorkloadState,
  WorkloadTelemetrySample,
} from './types.js';

export interface WorkloadAuthorityOptions {
  resourceCandidateProvider?: ResourceCandidateProvider;
  now?: () => string;
}

/**
 * IWIA — Institutional Workload Intelligence Authority (PHASE-19).
 *
 * Pipeline: workload registry → lifecycle/dependencies → advisory placement →
 * telemetry/history → forecast/IWDT → events and explainability. Resource scoring,
 * scheduling, allocation, and hardware management remain outside this authority.
 */
export class WorkloadAuthority {
  readonly registry = new WorkloadRegistry();
  readonly events = new WorkloadEventBus();
  readonly audit = new WorkloadAuditTrail();
  readonly history = new WorkloadHistoryStore();

  private readonly candidateProvider: ResourceCandidateProvider;
  private readonly nowFn: () => string;
  private telemetry = new Map<string, WorkloadTelemetrySample[]>();

  constructor(options: WorkloadAuthorityOptions = {}) {
    this.candidateProvider = options.resourceCandidateProvider ?? new NullResourceCandidateProvider();
    this.nowFn = options.now ?? (() => new Date().toISOString());
  }

  createWorkload(request: WorkloadCreateRequest): WorkloadProfile {
    this.validateCreateRequest(request);
    const now = this.now();
    const workloadId = request.workloadId ?? randomUUID();
    if (this.registry.get(workloadId)) {
      throw new WorkloadValidationError(`Workload "${workloadId}" already exists.`);
    }

    const profile: WorkloadProfile = {
      workloadId,
      type: request.type,
      owner: request.owner,
      state: 'created',
      assignedResources: [],
      runtimeState: 'not-started',
      estimatedDurationMs: request.estimatedDurationMs,
      priority: request.priority ?? 50,
      priorityReason: request.priorityReason ?? 'Default institutional workload priority.',
      dependencies: uniqueSorted(request.dependencies ?? []),
      resourceRequirements: {
        resourceType: request.resourceRequirements?.resourceType,
        requestedCapacity: request.resourceRequirements?.requestedCapacity,
        capabilityRefs: uniqueSorted(request.resourceRequirements?.capabilityRefs ?? []),
      },
      powerProfile: { ...request.powerProfile },
      thermalProfile: { ...request.thermalProfile },
      historicalPerformance: { completedRuns: 0, failedRuns: 0, successRate: 0 },
      createdReason: request.createdReason,
      createdAt: now,
      lastUpdated: now,
    };
    this.registry.upsert(profile);
    this.record(profile, 'created', 'lifecycle', 'created', request.createdReason, 'Workload Authority', { type: profile.type });
    this.events.publish(WORKLOAD_EVENTS.WorkloadCreated, { workloadId, profile });
    return profile;
  }

  validate(workloadId: string, reason = 'Workload profile and dependencies were validated.'): WorkloadProfile {
    const profile = this.registry.require(workloadId);
    for (const dependencyId of profile.dependencies) {
      if (dependencyId === workloadId) {
        throw new WorkloadDependencyError(workloadId, dependencyId, 'A workload cannot depend on itself.');
      }
      if (!this.registry.get(dependencyId)) {
        throw new WorkloadDependencyError(workloadId, dependencyId, `Unknown workload dependency: "${dependencyId}".`);
      }
    }
    return this.transition(profile, 'validated', 'validated', reason, 'Workload Authority');
  }

  queue(workloadId: string, reason = 'Workload is ready for institutional queueing.'): WorkloadProfile {
    const profile = this.transition(this.registry.require(workloadId), 'queued', 'queued', reason, 'Workload Authority');
    this.events.publish(WORKLOAD_EVENTS.WorkloadQueued, { workloadId, reason });
    return profile;
  }

  /** Records an externally confirmed assignment; it neither allocates nor reserves a resource. */
  markAssigned(
    workloadId: string,
    resources: Omit<AssignedResource, 'confirmedAt'>[],
    reason = 'External resource assignment was confirmed.',
    initiatingAuthority = 'External Authority',
  ): WorkloadProfile {
    const profile = this.registry.require(workloadId);
    this.assertDependenciesCompleted(profile);
    if (resources.length === 0) throw new WorkloadValidationError('At least one externally confirmed resource is required.');
    const now = this.now();
    const assignedResources = resources
      .map((resource) => ({ ...resource, providerExplanation: resource.providerExplanation ? [...resource.providerExplanation] : undefined, confirmedAt: now }))
      .sort((a, b) => a.resourceId.localeCompare(b.resourceId));
    const withAssignments: WorkloadProfile = { ...profile, assignedResources, lastUpdated: now };
    this.registry.upsert(withAssignments);
    const transitioned = this.transition(withAssignments, 'assigned', 'assigned', reason, initiatingAuthority, {
      resourceIds: assignedResources.map((resource) => resource.resourceId),
    });
    this.events.publish(WORKLOAD_EVENTS.WorkloadAssigned, { workloadId, assignedResources, reason });
    return transitioned;
  }

  start(workloadId: string, reason = 'Workload execution was reported as started.'): WorkloadProfile {
    const previous = this.registry.require(workloadId);
    const resumed = previous.state === 'paused';
    const updated = this.transition(previous, 'running', 'started', reason, 'Workload Authority');
    this.events.publish(WORKLOAD_EVENTS.WorkloadStarted, { workloadId, resumed, reason });
    return updated;
  }

  pause(workloadId: string, reason = 'Workload execution was paused.'): WorkloadProfile {
    const profile = this.transition(this.registry.require(workloadId), 'paused', 'paused', reason, 'Workload Authority');
    this.events.publish(WORKLOAD_EVENTS.WorkloadPaused, { workloadId, reason });
    return profile;
  }

  complete(workloadId: string, reason = 'Workload reported successful completion.'): WorkloadProfile {
    const profile = this.transition(this.registry.require(workloadId), 'completed', 'completed', reason, 'Workload Authority');
    const completed = this.recordTerminalPerformance(profile, 'completed');
    this.events.publish(WORKLOAD_EVENTS.WorkloadCompleted, { workloadId, reason });
    return completed;
  }

  fail(workloadId: string, reason: string): WorkloadProfile {
    const profile = this.transition(this.registry.require(workloadId), 'failed', 'failed', reason, 'Workload Authority');
    const failed = this.recordTerminalPerformance(profile, 'failed');
    this.events.publish(WORKLOAD_EVENTS.WorkloadFailed, { workloadId, reason });
    return failed;
  }

  /** Cancellation is an archived outcome, preserving the approved nine-state lifecycle. */
  cancel(workloadId: string, reason: string): WorkloadProfile {
    const profile = this.registry.require(workloadId);
    if (profile.state === 'completed' || profile.state === 'failed' || profile.state === 'archived') {
      throw new WorkloadValidationError(`Workload "${workloadId}" cannot be cancelled from ${profile.state}.`);
    }
    const archived = this.transition(profile, 'archived', 'cancelled', reason, 'Workload Authority');
    const updated: WorkloadProfile = { ...archived, outcome: 'cancelled', lastUpdated: this.now() };
    this.registry.upsert(updated);
    this.events.publish(WORKLOAD_EVENTS.WorkloadCancelled, { workloadId, reason });
    return updated;
  }

  archive(workloadId: string, reason = 'Terminal workload record archived.'): WorkloadProfile {
    const profile = this.registry.require(workloadId);
    if (profile.state !== 'completed' && profile.state !== 'failed') {
      throw new WorkloadValidationError('Only completed or failed workloads may be archived. Use cancel() for non-terminal cancellation.');
    }
    return this.transition(profile, 'archived', 'archived', reason, 'Workload Authority');
  }

  setPriority(workloadId: string, priority: number, reason: string): WorkloadProfile {
    this.assertPriority(priority);
    const profile = this.registry.require(workloadId);
    if (profile.state === 'archived') throw new WorkloadValidationError('Archived workload priority cannot be changed.');
    const updated = { ...profile, priority, priorityReason: reason, lastUpdated: this.now() };
    this.registry.upsert(updated);
    this.record(updated, 'priority-updated', 'priority', 'priority-updated', reason, 'Workload Authority', { priority });
    return updated;
  }

  /**
   * Workload-side placement recommendation only. Candidate rank and score are wholly
   * supplied by the injected provider (normally a composition adapter to IRIA).
   */
  recommendPlacement(workloadId: string): WorkloadPlacementRecommendation {
    const profile = this.registry.require(workloadId);
    const candidates = this.candidateProvider.rankCandidatesForWorkload({
      workloadId: profile.workloadId,
      workloadType: profile.type,
      priority: profile.priority,
      estimatedDurationMs: profile.estimatedDurationMs,
      resourceRequirements: profile.resourceRequirements,
    });
    const reasons: string[] = [];
    let action: WorkloadPlacementRecommendation['action'] = 'defer';

    const incomplete = this.incompleteDependencies(profile);
    if (profile.state !== 'validated' && profile.state !== 'queued') {
      reasons.push(`Workload state "${profile.state}" is not eligible for placement recommendation.`);
    } else if (incomplete.length > 0) {
      reasons.push(`Waiting for completed dependencies: ${incomplete.join(', ')}.`);
    } else if (candidates.length === 0) {
      reasons.push('No resource candidates were provided by the approved resource-candidate interface.');
    } else if (profile.state === 'validated') {
      action = 'queue';
      reasons.push('Workload is validated and has candidates; queueing is recommended before placement.');
    } else {
      action = 'place-now';
      reasons.push('Workload is queued, dependencies are complete, and a provider-ranked candidate is available.');
    }

    const recommendation: WorkloadPlacementRecommendation = {
      workloadId,
      action,
      priority: profile.priority,
      selectedCandidate: candidates[0],
      candidates: [...candidates],
      reasons,
      recommendedAt: this.now(),
    };
    this.record(profile, 'placement-recommended', 'recommendation', action, reasons.join(' '), 'Workload Authority', {
      selectedResourceId: recommendation.selectedCandidate?.resourceId,
      candidateCount: candidates.length,
      priority: profile.priority,
    });
    return recommendation;
  }

  /** Advisory queue order for balancing; no schedule is created and no resource is changed. */
  getBalanceRecommendations(): WorkloadBalanceRecommendation[] {
    return this.registry
      .byState('queued')
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt) || a.workloadId.localeCompare(b.workloadId))
      .map((profile, index) => {
        const placement = this.recommendPlacement(profile.workloadId);
        return {
          workloadId: profile.workloadId,
          priority: profile.priority,
          position: index + 1,
          placement,
          reasons: [`Ordered by workload priority ${profile.priority}/100.`, ...placement.reasons],
        };
      });
  }

  recordTelemetry(sample: WorkloadTelemetrySample): WorkloadDigitalTwin {
    this.registry.require(sample.workloadId);
    const samples = this.telemetry.get(sample.workloadId) ?? [];
    const frozen = Object.freeze({ ...sample, resourceUsage: { ...sample.resourceUsage } });
    samples.push(frozen);
    this.telemetry.set(sample.workloadId, samples);
    const profile = this.registry.require(sample.workloadId);
    this.record(profile, 'telemetry-recorded', 'telemetry', 'recorded', undefined, 'Telemetry Provider', {
      recordedAt: sample.recordedAt,
      throughput: sample.throughput,
    });
    this.updateForecast(sample.workloadId, 'Telemetry changed workload completion evidence.');
    return this.getDigitalTwin(sample.workloadId);
  }

  getForecast(workloadId: string): WorkloadForecast {
    const profile = this.registry.require(workloadId);
    return computeWorkloadForecast({
      profile,
      history: this.history.forWorkload(workloadId),
      telemetry: this.getTelemetry(workloadId),
      now: this.now(),
    });
  }

  updateForecast(workloadId: string, reason = 'Workload forecast refreshed.'): WorkloadForecast {
    const profile = this.registry.require(workloadId);
    const forecast = this.getForecast(workloadId);
    this.record(profile, 'forecast-updated', 'forecast', 'updated', reason, 'Workload Authority', {
      predictedCompletionAt: forecast.predictedCompletionAt,
      confidence: forecast.confidence,
    });
    this.events.publish(WORKLOAD_EVENTS.WorkloadForecastUpdated, { workloadId, forecast });
    return forecast;
  }

  getDigitalTwin(workloadId: string): WorkloadDigitalTwin {
    const profile = this.registry.require(workloadId);
    return assembleWorkloadDigitalTwin({
      profile,
      history: this.history.forWorkload(workloadId),
      telemetry: this.getTelemetry(workloadId),
      now: this.now(),
    });
  }

  explain(workloadId: string): WorkloadExplanation {
    const profile = this.registry.require(workloadId);
    return explainWorkload(profile, this.audit.forWorkload(workloadId));
  }

  getWorkload(workloadId: string): WorkloadProfile {
    return this.registry.require(workloadId);
  }

  getHistory(workloadId?: string): WorkloadHistoryEntry[] {
    return workloadId ? this.history.forWorkload(workloadId) : [...this.history.all()];
  }

  getTelemetry(workloadId: string): WorkloadTelemetrySample[] {
    return [...(this.telemetry.get(workloadId) ?? [])];
  }

  subscribe(event: WorkloadEventName, handler: (payload: unknown) => void): () => void {
    return this.events.subscribe(event, handler);
  }

  private now(): string {
    return this.nowFn();
  }

  private transition(
    profile: WorkloadProfile,
    to: WorkloadState,
    auditKind: WorkloadAuditRecord['kind'],
    reason: string,
    initiatingAuthority: string,
    details: Record<string, unknown> = {},
  ): WorkloadProfile {
    const from = profile.state;
    assertWorkloadStateTransition(from, to);
    const now = this.now();
    const updated: WorkloadProfile = {
      ...profile,
      state: to,
      runtimeState: runtimeStateFor(to),
      lastUpdated: now,
      ...(to === 'running' && !profile.startedAt ? { startedAt: now, pausedAt: undefined } : {}),
      ...(to === 'paused' ? { pausedAt: now } : {}),
      ...(to === 'completed' ? { completedAt: now, outcome: 'completed' as const } : {}),
      ...(to === 'failed' ? { failedAt: now, outcome: 'failed' as const } : {}),
      ...(to === 'archived' ? { archivedAt: now } : {}),
    };
    this.registry.upsert(updated);
    this.record(updated, auditKind, 'lifecycle', to, reason, initiatingAuthority, { from, to, ...details });
    return updated;
  }

  private recordTerminalPerformance(profile: WorkloadProfile, outcome: 'completed' | 'failed'): WorkloadProfile {
    const now = this.now();
    const historical = profile.historicalPerformance;
    const durationMs = profile.startedAt ? Math.max(0, Date.parse(now) - Date.parse(profile.startedAt)) : undefined;
    const completedRuns = historical.completedRuns + (outcome === 'completed' ? 1 : 0);
    const failedRuns = historical.failedRuns + (outcome === 'failed' ? 1 : 0);
    const totalRuns = completedRuns + failedRuns;
    const previousDurationTotal = (historical.averageDurationMs ?? 0) * (totalRuns - 1);
    const averageDurationMs = durationMs === undefined ? historical.averageDurationMs : (previousDurationTotal + durationMs) / totalRuns;
    const throughput = this.averageThroughput(profile.workloadId);
    const previousThroughputTotal = (historical.averageThroughput ?? 0) * (totalRuns - 1);
    const averageThroughput = throughput === undefined ? historical.averageThroughput : (previousThroughputTotal + throughput) / totalRuns;
    const updated: WorkloadProfile = {
      ...profile,
      lastUpdated: now,
      historicalPerformance: {
        completedRuns,
        failedRuns,
        successRate: totalRuns === 0 ? 0 : completedRuns / totalRuns,
        averageDurationMs,
        averageThroughput,
        lastCompletedAt: outcome === 'completed' ? now : historical.lastCompletedAt,
        lastFailedAt: outcome === 'failed' ? now : historical.lastFailedAt,
      },
    };
    this.registry.upsert(updated);
    return updated;
  }

  private averageThroughput(workloadId: string): number | undefined {
    const values = this.getTelemetry(workloadId)
      .map((sample) => sample.throughput)
      .filter((value): value is number => value !== undefined);
    return values.length === 0 ? undefined : values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private assertDependenciesCompleted(profile: WorkloadProfile): void {
    const incomplete = this.incompleteDependencies(profile);
    if (incomplete.length > 0) throw new WorkloadDependencyError(profile.workloadId, incomplete[0]!);
  }

  private incompleteDependencies(profile: WorkloadProfile): string[] {
    return profile.dependencies.filter((id) => this.registry.get(id)?.outcome !== 'completed');
  }

  private validateCreateRequest(request: WorkloadCreateRequest): void {
    if (!request.owner.trim()) throw new WorkloadValidationError('Workload owner is required.');
    if (!request.createdReason.trim()) throw new WorkloadValidationError('Workload creation reason is required.');
    if (!Number.isFinite(request.estimatedDurationMs) || request.estimatedDurationMs <= 0) {
      throw new WorkloadValidationError('Estimated duration must be a positive finite number of milliseconds.');
    }
    this.assertPriority(request.priority ?? 50);
    if (request.resourceRequirements?.requestedCapacity !== undefined && request.resourceRequirements.requestedCapacity <= 0) {
      throw new WorkloadValidationError('Requested resource capacity must be positive when supplied.');
    }
  }

  private assertPriority(priority: number): void {
    if (!Number.isInteger(priority) || priority < 0 || priority > 100) throw new InvalidWorkloadPriorityError(priority);
  }

  private record(
    profile: WorkloadProfile,
    auditKind: WorkloadAuditRecord['kind'],
    historyKind: WorkloadHistoryEntry['kind'],
    action: string,
    reason: string | undefined,
    initiatingAuthority: string,
    details: Record<string, unknown>,
  ): void {
    const timestamp = this.now();
    this.audit.record({ timestamp, workloadId: profile.workloadId, kind: auditKind, details, reason, initiatingAuthority });
    this.history.append({ timestamp, workloadId: profile.workloadId, kind: historyKind, action, details, reason, initiatingAuthority });
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function runtimeStateFor(state: WorkloadState): WorkloadProfile['runtimeState'] {
  switch (state) {
    case 'created':
    case 'validated':
      return 'not-started';
    case 'queued':
    case 'assigned':
    case 'running':
    case 'paused':
    case 'completed':
    case 'failed':
    case 'archived':
      return state;
  }
}
