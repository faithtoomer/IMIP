import { randomUUID } from 'node:crypto';
import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { compareBenchmarkRuns, performanceTrend } from './comparison.js';
import { BenchmarkValidationError } from './errors.js';
import { BENCHMARK_EVENTS, BenchmarkEventBus, type BenchmarkEventName } from './events.js';
import { BenchmarkAuditTrail, explainBenchmark } from './explainability.js';
import { InstitutionalPerformanceKnowledgeBase } from './ipkb.js';
import { assertBenchmarkLifecycleTransition } from './lifecycle.js';
import { withDefaultBenchmarkProviders } from './providers.js';
import { BenchmarkCatalog, BenchmarkRunRegistry } from './registry.js';
import type {
  BenchmarkComparison,
  BenchmarkExplanation,
  BenchmarkLifecycleRecord,
  BenchmarkProviders,
  BenchmarkRecommendation,
  BenchmarkRun,
  BenchmarkRunInput,
  BenchmarkTypeDefinition,
  HardwareBenchmarkResult,
  InstitutionalPerformanceKnowledgeRecord,
  IPKBQuery,
} from './types.js';

export interface BenchmarkAuthorityOptions {
  providers?: BenchmarkProviders;
  eventBus?: InstitutionalEventBus;
  now?: () => string;
  regressionThresholdPercent?: number;
}

/**
 * IBIA — Institutional Benchmark Intelligence Authority (PHASE-21).
 *
 * It owns the Catalog, lifecycle orchestration, comparisons, explainability, and
 * IPKB. Raw per-device BenchmarkResult persistence remains certified IHIS ownership:
 * `store()` invokes only the injected IHIS-shaped HardwareBenchmarkStore contract.
 */
export class BenchmarkAuthority {
  readonly catalog = new BenchmarkCatalog();
  readonly registry = new BenchmarkRunRegistry();
  readonly audit = new BenchmarkAuditTrail();
  readonly ipkb = new InstitutionalPerformanceKnowledgeBase();
  readonly events: BenchmarkEventBus;

  private readonly providers: ReturnType<typeof withDefaultBenchmarkProviders>;
  private readonly nowFn: () => string;
  private readonly regressionThresholdPercent: number;
  private comparisons = new Map<string, BenchmarkComparison>();
  private recommendations = new Map<string, BenchmarkRecommendation>();

  constructor(options: BenchmarkAuthorityOptions = {}) {
    this.providers = withDefaultBenchmarkProviders(options.providers);
    this.events = new BenchmarkEventBus(options.eventBus);
    this.nowFn = options.now ?? (() => new Date().toISOString());
    this.regressionThresholdPercent = options.regressionThresholdPercent ?? 5;
  }

  registerBenchmarkType(definition: BenchmarkTypeDefinition): void {
    this.catalog.register(definition);
  }

  removeBenchmarkType(typeId: string, version: string): boolean {
    return this.catalog.remove(typeId, version);
  }

  create(input: BenchmarkRunInput): BenchmarkRun {
    const definition = this.catalog.require(input.benchmarkTypeId, input.benchmarkVersion);
    if (!definition.active) throw new BenchmarkValidationError(`Benchmark type ${definition.typeId} v${definition.version} is inactive.`);
    if (!input.component.trim() || !input.deviceId.trim() || !input.reason.trim()) {
      throw new BenchmarkValidationError('Benchmark component, device id, and reason are required.');
    }
    const now = this.now();
    const run: BenchmarkRun = {
      runId: randomUUID(),
      benchmarkTypeId: definition.typeId,
      benchmarkVersion: definition.version,
      category: definition.category,
      component: input.component,
      deviceId: input.deviceId,
      state: 'created',
      reason: input.reason,
      createdAt: now,
      environment: { ...(input.environment ?? {}) },
      hardwareProfile: { deviceId: input.hardwareProfile?.deviceId ?? input.deviceId, ...(input.hardwareProfile ?? {}) },
      powerProfile: { ...(input.powerProfile ?? {}) },
      thermalProfile: { ...(input.thermalProfile ?? {}) },
      rawResultStoredBy: undefined,
    };
    this.registry.upsert(run);
    this.recordTransition(run.runId, undefined, 'created', 'Benchmark orchestration record created.');
    return this.registry.require(run.runId);
  }

  validate(runId: string, notes: string[] = []): BenchmarkRun {
    const run = this.registry.require(runId);
    this.assertTransition(run, 'validated');
    const definition = this.catalog.require(run.benchmarkTypeId, run.benchmarkVersion);
    if (!definition.componentKinds.includes(run.component) && !definition.componentKinds.includes('*')) {
      throw new BenchmarkValidationError(`Component ${run.component} is not supported by benchmark type ${definition.typeId}.`);
    }
    return this.transition(run, 'validated', 'Benchmark type, component, and required provenance validated.', { validatedAt: this.now(), verificationNotes: [...notes] });
  }

  /** Records an externally-confirmed schedule; IBIA neither creates schedules nor controls the Scheduler Authority. */
  markScheduled(runId: string, scheduledFor: string): BenchmarkRun {
    if (Number.isNaN(Date.parse(scheduledFor))) throw new BenchmarkValidationError('Scheduled time must be a valid ISO timestamp.');
    const run = this.registry.require(runId);
    this.assertTransition(run, 'scheduled');
    return this.transition(run, 'scheduled', 'External scheduling confirmation recorded by IBIA.', { scheduledFor });
  }

  /** Captures a standardized result envelope; execution itself is supplied by the calling workflow. */
  execute(runId: string, result: Omit<HardwareBenchmarkResult, 'deviceId' | 'workload' | 'recordedAt'> & { recordedAt?: string }, durationMs: number): BenchmarkRun {
    const run = this.registry.require(runId);
    this.assertTransition(run, 'executed');
    if (!Number.isFinite(durationMs) || durationMs < 0) throw new BenchmarkValidationError('Benchmark duration must be a non-negative finite number.');
    if (!result.metric.trim() || !result.unit.trim() || !Number.isFinite(result.value)) {
      throw new BenchmarkValidationError('Benchmark result metric, unit, and finite value are required.');
    }
    const standardized: HardwareBenchmarkResult = {
      deviceId: run.deviceId,
      workload: run.benchmarkTypeId,
      metric: result.metric,
      value: result.value,
      unit: result.unit,
      recordedAt: result.recordedAt ?? this.now(),
    };
    const executed = this.transition(run, 'executed', 'Standardized benchmark execution result captured.', {
      executedAt: this.now(),
      durationMs,
      result: standardized,
    });
    this.events.publish(BENCHMARK_EVENTS.BenchmarkStarted, { run: executed });
    this.events.publish(BENCHMARK_EVENTS.BenchmarkCompleted, { run: executed });
    return executed;
  }

  verify(runId: string, notes: string[] = []): BenchmarkRun {
    const run = this.registry.require(runId);
    this.assertTransition(run, 'verified');
    if (!run.result) throw new BenchmarkValidationError('An executed benchmark result is required before verification.');
    const verified = this.transition(run, 'verified', 'Result shape and lifecycle evidence verified.', {
      verifiedAt: this.now(),
      verificationNotes: [...(run.verificationNotes ?? []), ...notes],
    });
    this.events.publish(BENCHMARK_EVENTS.BenchmarkVerified, { run: verified });
    return verified;
  }

  /**
   * The sole raw storage write: this delegates to IHIS's certified store shape.
   * IBIA retains only its higher-level lifecycle and IPKB evidence.
   */
  store(runId: string): BenchmarkRun {
    const run = this.registry.require(runId);
    this.assertTransition(run, 'stored');
    if (!run.result) throw new BenchmarkValidationError('A verified result is required before storage.');
    this.providers.hardwareStore.record(run.result);
    const stored = this.transition(run, 'stored', 'Raw per-device result recorded through the injected IHIS BenchmarkRegistry contract.', {
      storedAt: this.now(),
      rawResultStoredBy: 'IHIS BenchmarkRegistry',
    });
    this.ipkb.record(stored, this.providers);
    return stored;
  }

  compare(runId: string): BenchmarkComparison {
    const run = this.registry.require(runId);
    this.assertTransition(run, 'compared');
    const definition = this.catalog.require(run.benchmarkTypeId, run.benchmarkVersion);
    const baseline = this.registry.historyFor(run.benchmarkTypeId, run.component, run.benchmarkVersion)
      .filter((candidate) => candidate.runId !== run.runId && candidate.result !== undefined && ['stored', 'compared', 'archived'].includes(candidate.state))
      .sort((a, b) => (b.storedAt ?? b.executedAt ?? '').localeCompare(a.storedAt ?? a.executedAt ?? ''))[0];
    const comparison = compareBenchmarkRuns(run, baseline, definition.direction, {
      regressionThresholdPercent: this.regressionThresholdPercent,
      now: this.now(),
    });
    const compared = this.transition(run, 'compared', 'Historical baseline comparison completed.', { comparedAt: comparison.comparedAt });
    this.comparisons.set(runId, comparison);
    this.ipkb.record(compared, this.providers, comparison);
    this.events.publish(BENCHMARK_EVENTS.BenchmarkCompared, { run: compared, comparison });
    if (comparison.regressionDetected) this.events.publish(BENCHMARK_EVENTS.BenchmarkRegressionDetected, { run: compared, comparison });
    this.generateRecommendation(compared, comparison);
    return comparison;
  }

  archive(runId: string): BenchmarkRun {
    const run = this.registry.require(runId);
    this.assertTransition(run, 'archived');
    return this.transition(run, 'archived', 'Benchmark lifecycle closed and retained as institutional evidence.', { archivedAt: this.now() });
  }

  /** Failure is an event/audit condition—not a ninth lifecycle state or a scheduling decision. */
  fail(runId: string, reason: string): BenchmarkRun {
    const run = this.registry.require(runId);
    if (!reason.trim()) throw new BenchmarkValidationError('Benchmark failure reason is required.');
    const failed: BenchmarkRun = { ...run, failureReason: reason };
    this.registry.upsert(failed);
    this.events.publish(BENCHMARK_EVENTS.BenchmarkFailed, { run: this.registry.require(runId), reason });
    return this.registry.require(runId);
  }

  getRun(runId: string): BenchmarkRun {
    return this.registry.require(runId);
  }

  getComparison(runId: string): BenchmarkComparison | undefined {
    return this.comparisons.get(runId);
  }

  getRecommendation(runId: string): BenchmarkRecommendation | undefined {
    return this.recommendations.get(runId);
  }

  explain(runId: string): BenchmarkExplanation {
    const run = this.registry.require(runId);
    return explainBenchmark(
      run,
      this.catalog.require(run.benchmarkTypeId, run.benchmarkVersion),
      this.audit.forRun(runId),
      this.comparisons.get(runId),
      this.recommendations.get(runId),
    );
  }

  queryKnowledge(query: IPKBQuery = {}): InstitutionalPerformanceKnowledgeRecord[] {
    return this.ipkb.query(query);
  }

  highestHashratePerWatt(query: Omit<IPKBQuery, 'metric'> = {}) {
    return this.ipkb.highestHashratePerWatt(query);
  }

  getPerformanceTrend(typeId: string, component: string, version: string) {
    const definition = this.catalog.require(typeId, version);
    return performanceTrend(this.registry.historyFor(typeId, component, version), definition.direction);
  }

  subscribe(event: BenchmarkEventName, handler: (payload: unknown) => void): () => void {
    return this.events.subscribe(event, handler);
  }

  private generateRecommendation(run: BenchmarkRun, comparison: BenchmarkComparison): BenchmarkRecommendation {
    const recommendation: BenchmarkRecommendation = {
      recommendationId: randomUUID(),
      runId: run.runId,
      createdAt: this.now(),
      recommendation: comparison.regressionDetected
        ? 'Advisory: investigate the correlated runtime, driver, configuration, power, and thermal evidence before any external decision.'
        : comparison.classification === 'improved'
          ? 'Advisory: retain this configuration as a candidate institutional baseline and continue gathering comparable evidence.'
          : 'Advisory: continue collecting comparable benchmark evidence; IBIA does not make operational decisions.',
      rationale: [
        comparison.baselineDescription,
        `Comparison classification: ${comparison.classification}.`,
        'Recommendation is informational only and does not allocate, schedule, mine, or change configuration.',
      ],
      advisory: true,
    };
    this.recommendations.set(run.runId, recommendation);
    this.events.publish(BENCHMARK_EVENTS.BenchmarkRecommendationGenerated, { run, comparison, recommendation });
    return recommendation;
  }

  private assertTransition(run: BenchmarkRun, to: BenchmarkRun['state']): void {
    assertBenchmarkLifecycleTransition(run.state, to);
  }

  private transition(run: BenchmarkRun, to: BenchmarkRun['state'], reason: string, update: Partial<BenchmarkRun>): BenchmarkRun {
    const transitioned: BenchmarkRun = { ...run, ...update, state: to };
    this.registry.upsert(transitioned);
    this.recordTransition(run.runId, run.state, to, reason);
    return this.registry.require(run.runId);
  }

  private recordTransition(runId: string, from: BenchmarkLifecycleRecord['from'], to: BenchmarkLifecycleRecord['to'], reason: string): void {
    this.audit.record({ runId, from, to, at: this.now(), reason });
  }

  private now(): string {
    return this.nowFn();
  }
}
