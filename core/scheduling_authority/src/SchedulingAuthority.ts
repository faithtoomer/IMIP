import { randomUUID } from 'node:crypto';
import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import type { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import type { HardwareAuthority } from '../../hardware_authority/src/index.js';
import type { RuntimeOrchestrator } from '../../runtime_bootstrap/src/index.js';
import { ScheduleRegistry } from './registry.js';
import { ScheduleDependencyGraph } from './dependencyGraph.js';
import { InstitutionalTimeGraph } from './timeGraph.js';
import { assertScheduleTransition } from './lifecycle.js';
import { computeNextExecution } from './timeEvaluator.js';
import { computeRetryDelayMs } from './retry.js';
import { PERMISSIVE_POLICY_EVALUATOR, PERMISSIVE_RESOURCE_EVALUATOR, hardwareResourceEvaluator } from './evaluators.js';
import { SCHEDULE_EVENT_DEFINITIONS, PUBLISHER_AUTHORITY } from './events.js';
import { InvalidScheduleError, ScheduleNotFoundError } from './errors.js';
import { SCHEDULE_EVENTS } from './types.js';
import type {
  ExecutionContext,
  ExecutionOutcome,
  ExecutionRecord,
  PolicyEvaluator,
  ResourceEvaluator,
  ScheduleDefinition,
  ScheduleExecutionHandler,
  ScheduleInput,
  ScheduleStatus,
  SchedulingMetrics,
  TickResult,
} from './types.js';

export interface SchedulingAuthorityOptions {
  eventBus?: InstitutionalEventBus;
  observabilityAuthority?: ObservabilityAuthority;
  policyEvaluator?: PolicyEvaluator;
  resourceEvaluator?: ResourceEvaluator;
  hardwareAuthority?: HardwareAuthority;
  runtimeOrchestrator?: RuntimeOrchestrator;
  /** Injectable clock — deterministic execution (Law 6) and real
   * testability without faking global time. */
  now?: () => Date;
}

const HISTORY_LIMIT_PER_SCHEDULE = 200;
const LOG_CATEGORY = 'scheduler';
const NON_IEB_LOG_OPERATIONS = ['schedule-paused', 'schedule-resumed'];

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Execution exceeded its ${timeoutMs}ms timeout.`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * ISOA — the Institutional Scheduling & Orchestration Authority (PHASE-11).
 * The sole authority for time-based and policy-driven execution scheduling.
 * ISOA never contains mining/decision/hardware logic itself (§4) — every
 * registered schedule supplies its own `ScheduleExecutionHandler`.
 *
 * Publishes directly through the real IEB (no legacy sync API to preserve,
 * IRBLM's pattern) and, when an ObservabilityAuthority is supplied, logs
 * every lifecycle event through it too — §17 names "the Observability
 * Authority" specifically (not "a future Telemetry Authority"), and IOLA
 * now exists.
 */
export class SchedulingAuthority {
  readonly registry = new ScheduleRegistry();
  readonly graph: InstitutionalTimeGraph;

  private readonly dependencyGraph = new ScheduleDependencyGraph();
  private readonly handlers = new Map<string, ScheduleExecutionHandler>();
  private readonly history = new Map<string, ExecutionRecord[]>();
  /** Persists the in-progress retry attempt number across separate tick()/
   * notify*() calls — a schedule's retry sequence spans multiple, separate
   * invocations of this class's public methods, not one call stack. */
  private readonly attemptCounts = new Map<string, number>();
  private readonly eventBus?: InstitutionalEventBus;
  private readonly observability?: ObservabilityAuthority;
  private readonly policyEvaluator: PolicyEvaluator;
  private readonly resourceEvaluator: ResourceEvaluator;
  private readonly runtimeOrchestrator?: RuntimeOrchestrator;
  private readonly now: () => Date;

  private scheduledJobs = 0;
  private successfulExecutions = 0;
  private failedExecutions = 0;
  private delayedExecutions = 0;
  private retryCount = 0;
  private readonly schedulingDurations: number[] = [];
  private readonly executionDurations: number[] = [];

  constructor(options: SchedulingAuthorityOptions = {}) {
    this.eventBus = options.eventBus;
    this.observability = options.observabilityAuthority;
    this.policyEvaluator = options.policyEvaluator ?? PERMISSIVE_POLICY_EVALUATOR;
    this.resourceEvaluator =
      options.resourceEvaluator ?? (options.hardwareAuthority ? hardwareResourceEvaluator(options.hardwareAuthority) : PERMISSIVE_RESOURCE_EVALUATOR);
    this.runtimeOrchestrator = options.runtimeOrchestrator;
    this.now = options.now ?? (() => new Date());
    this.graph = new InstitutionalTimeGraph(
      (scheduleId) => this.dependencyGraph.dependenciesOf(scheduleId),
      (scheduleId) => this.history.get(scheduleId) ?? [],
    );

    if (this.eventBus) {
      for (const definition of SCHEDULE_EVENT_DEFINITIONS) {
        if (!this.eventBus.getEventDefinition(definition.name)) {
          this.eventBus.registerEventType(definition);
        }
      }
    }

    if (this.observability) {
      for (const definition of SCHEDULE_EVENT_DEFINITIONS) {
        if (!this.observability.schemas.get(LOG_CATEGORY, definition.name)) {
          this.observability.registerSchema({ category: LOG_CATEGORY, operation: definition.name, description: definition.description });
        }
      }
      for (const operation of NON_IEB_LOG_OPERATIONS) {
        if (!this.observability.schemas.get(LOG_CATEGORY, operation)) {
          this.observability.registerSchema({ category: LOG_CATEGORY, operation, description: `ISOA operation: ${operation}` });
        }
      }
    }
  }

  // ---- Registration (§7/§8) ----

  async registerSchedule(input: ScheduleInput, handler: ScheduleExecutionHandler): Promise<ScheduleDefinition> {
    const start = performance.now();
    if (!input.name || !input.ownerAuthority) throw new InvalidScheduleError('name and ownerAuthority are required.');

    const scheduleId = randomUUID();
    let schedule: ScheduleDefinition = {
      scheduleId,
      name: input.name,
      description: input.description ?? '',
      ownerAuthority: input.ownerAuthority,
      scheduleType: input.scheduleType,
      trigger: input.trigger,
      dependencies: input.dependencies ?? [],
      requiredRuntimeState: input.requiredRuntimeState,
      requiredDevices: input.requiredDevices,
      requiredPolicies: input.requiredPolicies,
      priority: input.priority ?? 'normal',
      retryPolicy: input.retryPolicy,
      timeoutMs: input.timeoutMs,
      status: 'created',
      createdAt: this.now().toISOString(),
    };
    await this.publish(SCHEDULE_EVENTS.ScheduleCreated, { scheduleId, name: schedule.name });

    assertScheduleTransition('created', 'validated');
    schedule = { ...schedule, status: 'validated' };
    await this.publish(SCHEDULE_EVENTS.ScheduleValidated, { scheduleId });

    this.dependencyGraph.register(scheduleId, schedule.dependencies);

    assertScheduleTransition('validated', 'registered');
    schedule = { ...schedule, status: 'registered' };
    this.registry.register(schedule);
    this.handlers.set(scheduleId, handler);
    this.history.set(scheduleId, []);
    this.scheduledJobs += 1;

    assertScheduleTransition('registered', 'eligible');
    schedule = this.computeNextExecutionAndTransition({ ...schedule, status: 'eligible' });
    this.registry.update(schedule);

    await this.publish(SCHEDULE_EVENTS.ScheduleRegistered, { scheduleId, name: schedule.name });
    this.schedulingDurations.push(performance.now() - start);
    return schedule;
  }

  private computeNextExecutionAndTransition(schedule: ScheduleDefinition): ScheduleDefinition {
    if (schedule.trigger.kind !== 'time') return schedule;
    const next = computeNextExecution(schedule.trigger, this.now());
    return { ...schedule, nextExecutionAt: next?.toISOString() };
  }

  // ---- Controlled interfaces (§15) ----

  async pause(scheduleId: string, reason: string, initiatingAuthority: string): Promise<ScheduleDefinition> {
    const schedule = this.registry.require(scheduleId);
    assertScheduleTransition(schedule.status, 'paused');
    const updated: ScheduleDefinition = { ...schedule, status: 'paused' };
    this.registry.update(updated);
    this.logOnly('schedule-paused', { scheduleId, reason, initiatingAuthority });
    return updated;
  }

  async resume(scheduleId: string, initiatingAuthority: string): Promise<ScheduleDefinition> {
    const schedule = this.registry.require(scheduleId);
    assertScheduleTransition(schedule.status, 'eligible');
    // Deliberately preserves the schedule's existing nextExecutionAt rather
    // than recomputing it from "now" — a schedule paused while already due
    // should fire on the very next tick(), not silently skip that
    // occurrence and wait a full new interval.
    const updated: ScheduleDefinition = { ...schedule, status: 'eligible' };
    this.registry.update(updated);
    this.logOnly('schedule-resumed', { scheduleId, initiatingAuthority });
    return updated;
  }

  async cancel(scheduleId: string, reason: string, initiatingAuthority: string): Promise<ScheduleDefinition> {
    const schedule = this.registry.require(scheduleId);
    assertScheduleTransition(schedule.status, 'cancelled');
    const updated: ScheduleDefinition = { ...schedule, status: 'cancelled' };
    this.registry.update(updated);
    this.dependencyGraph.remove(scheduleId);
    this.attemptCounts.delete(scheduleId);
    await this.publish(SCHEDULE_EVENTS.ScheduleCancelled, { scheduleId, reason, initiatingAuthority });
    return updated;
  }

  async triggerManually(scheduleId: string): Promise<ExecutionOutcome> {
    const schedule = this.registry.require(scheduleId);
    if (schedule.status !== 'eligible' && schedule.status !== 'registered') {
      throw new InvalidScheduleError(`Schedule "${scheduleId}" is not in a triggerable state (currently "${schedule.status}").`);
    }
    let current = schedule;
    if (current.status !== 'eligible') {
      assertScheduleTransition(current.status, 'eligible');
      current = { ...current, status: 'eligible' };
      this.registry.update(current);
    }
    this.attemptCounts.delete(scheduleId); // a manual trigger always starts a fresh attempt sequence
    return this.executeOne(current, 'manual', this.now());
  }

  // ---- Externally-signaled triggers (event/ai-recommendation) ----

  async notifyEvent(eventName: string): Promise<void> {
    const now = this.now();
    for (const schedule of this.registry.all()) {
      if (schedule.status !== 'eligible' || schedule.trigger.kind !== 'event' || schedule.trigger.eventName !== eventName) continue;
      await this.attemptOrDelay(schedule, 'event', now);
    }
  }

  async notifyRecommendation(scheduleId: string, confidence: number): Promise<ExecutionOutcome | undefined> {
    const schedule = this.registry.require(scheduleId);
    if (schedule.trigger.kind !== 'ai-recommendation') {
      throw new InvalidScheduleError(`Schedule "${scheduleId}" does not have an ai-recommendation trigger.`);
    }
    if (schedule.status !== 'eligible') return undefined;
    if (confidence < (schedule.trigger.minConfidence ?? 0)) return undefined;
    return this.attemptOrDelay(schedule, 'ai-recommendation', this.now());
  }

  private async attemptOrDelay(
    schedule: ScheduleDefinition,
    triggeredBy: ExecutionContext['triggeredBy'],
    now: Date,
  ): Promise<ExecutionOutcome | undefined> {
    const reasons = this.checkEligibility(schedule, now);
    if (reasons.length > 0) {
      this.delayedExecutions += 1;
      await this.publish(SCHEDULE_EVENTS.ScheduleDelayed, { scheduleId: schedule.scheduleId, reasons });
      this.recordSkippedAttempt(schedule.scheduleId, reasons, now);
      return undefined;
    }
    return this.executeOne(schedule, triggeredBy, now);
  }

  // ---- Evaluation loop (§9/§10/§11) ----

  async tick(at?: Date): Promise<TickResult> {
    const now = at ?? this.now();
    const result: TickResult = { evaluatedAt: now.toISOString(), executed: [], skipped: [], failed: [] };

    for (const schedule of this.registry.all()) {
      if (schedule.status !== 'eligible') continue;

      if (schedule.trigger.kind === 'time') {
        if (!schedule.nextExecutionAt || new Date(schedule.nextExecutionAt).getTime() > now.getTime()) continue;
      } else if (schedule.trigger.kind === 'conditional') {
        if (!schedule.trigger.evaluate({ now })) continue;
      } else if (schedule.trigger.kind !== 'policy') {
        continue; // manual/event/ai-recommendation require an explicit call, not a tick
      }

      const reasons = this.checkEligibility(schedule, now);
      if (reasons.length > 0) {
        this.delayedExecutions += 1;
        result.skipped.push({ scheduleId: schedule.scheduleId, reasons });
        this.recordSkippedAttempt(schedule.scheduleId, reasons, now);

        const isUnrecoverable = schedule.trigger.kind === 'time' && schedule.trigger.at !== undefined;
        if (isUnrecoverable) {
          await this.publish(SCHEDULE_EVENTS.ScheduleSkipped, { scheduleId: schedule.scheduleId, reasons });
          assertScheduleTransition(schedule.status, 'retired');
          this.registry.update({ ...schedule, status: 'retired' });
        } else {
          await this.publish(SCHEDULE_EVENTS.ScheduleDelayed, { scheduleId: schedule.scheduleId, reasons });
        }
        continue;
      }

      const outcome = await this.executeOne(schedule, schedule.trigger.kind === 'policy' ? 'policy' : 'time', now);
      if (outcome.success) result.executed.push(schedule.scheduleId);
      else result.failed.push({ scheduleId: schedule.scheduleId, error: outcome.message ?? 'unknown error' });
    }

    return result;
  }

  private checkEligibility(schedule: ScheduleDefinition, now: Date): string[] {
    const reasons: string[] = [];

    const unmetDependencies = schedule.dependencies.filter((dependencyId) => {
      const records = this.history.get(dependencyId) ?? [];
      const last = records[records.length - 1];
      return !last || last.result !== 'success';
    });
    if (unmetDependencies.length > 0) {
      reasons.push(`Waiting on dependenc${unmetDependencies.length === 1 ? 'y' : 'ies'}: ${unmetDependencies.join(', ')}.`);
    }

    if (schedule.requiredRuntimeState && this.runtimeOrchestrator) {
      const state = this.runtimeOrchestrator.getRuntimeState();
      if (!schedule.requiredRuntimeState.includes(state)) {
        reasons.push(`Requires platform runtime state ${schedule.requiredRuntimeState.join('|')}, currently "${state}".`);
      }
    }

    const blocked = this.graph.isBlockedAt(now);
    if (blocked.blocked) reasons.push(...blocked.reasons);

    const policyResult = this.policyEvaluator.evaluate(schedule, { now });
    if (!policyResult.approved) reasons.push(...policyResult.reasons);

    const resourceResult = this.resourceEvaluator.evaluate(schedule, { now });
    if (!resourceResult.available) reasons.push(...resourceResult.reasons);

    return reasons;
  }

  private async executeOne(
    schedule: ScheduleDefinition,
    triggeredBy: ExecutionContext['triggeredBy'],
    now: Date,
  ): Promise<ExecutionOutcome> {
    const handler = this.handlers.get(schedule.scheduleId);
    if (!handler) throw new ScheduleNotFoundError(schedule.scheduleId);
    const attempt = this.attemptCounts.get(schedule.scheduleId) ?? 1;

    assertScheduleTransition(schedule.status, 'scheduled');
    let current: ScheduleDefinition = { ...schedule, status: 'scheduled' };
    this.registry.update(current);
    await this.publish(SCHEDULE_EVENTS.ScheduleTriggered, { scheduleId: schedule.scheduleId, attempt });

    assertScheduleTransition('scheduled', 'executing');
    current = { ...current, status: 'executing' };
    this.registry.update(current);
    const executionId = randomUUID();
    const startedAt = now.toISOString();
    await this.publish(SCHEDULE_EVENTS.ScheduleStarted, { scheduleId: schedule.scheduleId, executionId });

    const perfStart = performance.now();
    let outcome: ExecutionOutcome;
    try {
      const execution = handler.execute({ schedule, attempt, triggeredBy });
      outcome = schedule.timeoutMs ? await withTimeout(execution, schedule.timeoutMs) : await execution;
    } catch (error) {
      outcome = { success: false, message: (error as Error).message };
    }
    this.executionDurations.push(performance.now() - perfStart);

    const record: ExecutionRecord = {
      executionId,
      scheduleId: schedule.scheduleId,
      attempt,
      startedAt,
      completedAt: this.now().toISOString(),
      result: outcome.success ? 'success' : 'failure',
      delayReasons: [],
      error: outcome.success ? undefined : outcome.message,
    };
    this.pushHistory(schedule.scheduleId, record);

    if (outcome.success) {
      this.attemptCounts.delete(schedule.scheduleId);
      this.successfulExecutions += 1;
      current = { ...current, status: 'completed', lastExecutionAt: record.completedAt };
      this.registry.update(current);
      await this.publish(SCHEDULE_EVENTS.ScheduleCompleted, { scheduleId: schedule.scheduleId, executionId });
      await this.rescheduleOrRetire(current);
    } else {
      this.failedExecutions += 1;
      current = { ...current, status: 'failed', lastExecutionAt: record.completedAt };
      this.registry.update(current);
      await this.publish(SCHEDULE_EVENTS.ScheduleFailed, { scheduleId: schedule.scheduleId, executionId, error: outcome.message });
      await this.handleRetry(current, attempt);
    }

    return outcome;
  }

  private async handleRetry(schedule: ScheduleDefinition, attempt: number): Promise<void> {
    if (!schedule.retryPolicy) {
      this.attemptCounts.delete(schedule.scheduleId);
      await this.rescheduleOrRetire(schedule);
      return;
    }
    const delayMs = computeRetryDelayMs(schedule.retryPolicy, attempt);
    if (delayMs === undefined) {
      this.attemptCounts.delete(schedule.scheduleId); // exhausted or manual — stays 'failed'; a future manual trigger starts fresh
      return;
    }

    this.attemptCounts.set(schedule.scheduleId, attempt + 1);
    this.retryCount += 1;
    await this.publish(SCHEDULE_EVENTS.ScheduleRetried, { scheduleId: schedule.scheduleId, attempt: attempt + 1, delayMs });

    assertScheduleTransition('failed', 'rescheduled');
    let updated: ScheduleDefinition = { ...schedule, status: 'rescheduled' };
    this.registry.update(updated);
    assertScheduleTransition('rescheduled', 'eligible');
    updated = { ...updated, status: 'eligible', nextExecutionAt: new Date(this.now().getTime() + delayMs).toISOString() };
    this.registry.update(updated);
  }

  private async rescheduleOrRetire(schedule: ScheduleDefinition): Promise<void> {
    const isRecurring = schedule.trigger.kind === 'time' && (schedule.trigger.intervalMs !== undefined || Boolean(schedule.trigger.dailyAt) || Boolean(schedule.trigger.weeklyAt));
    const to: ScheduleStatus = isRecurring || schedule.trigger.kind !== 'time' ? 'rescheduled' : 'retired';
    assertScheduleTransition(schedule.status, to);

    if (to === 'retired') {
      this.registry.update({ ...schedule, status: 'retired' });
      return;
    }
    let updated: ScheduleDefinition = { ...schedule, status: 'rescheduled' };
    this.registry.update(updated);
    assertScheduleTransition('rescheduled', 'eligible');
    updated = this.computeNextExecutionAndTransition({ ...updated, status: 'eligible' });
    this.registry.update(updated);
  }

  private recordSkippedAttempt(scheduleId: string, reasons: string[], now: Date): void {
    this.pushHistory(scheduleId, {
      executionId: randomUUID(),
      scheduleId,
      attempt: 0,
      startedAt: now.toISOString(),
      completedAt: now.toISOString(),
      result: 'skipped',
      delayReasons: reasons,
    });
  }

  private pushHistory(scheduleId: string, record: ExecutionRecord): void {
    const list = this.history.get(scheduleId) ?? [];
    list.push(record);
    if (list.length > HISTORY_LIMIT_PER_SCHEDULE) list.shift();
    this.history.set(scheduleId, list);
  }

  // ---- Explainability (§14) ----

  explain(scheduleId: string): {
    schedule: ScheduleDefinition;
    dependencies: string[];
    history: ExecutionRecord[];
    activeWindows: ReturnType<InstitutionalTimeGraph['activeWindowsAt']>;
    delayReasons: string[];
  } {
    const schedule = this.registry.require(scheduleId);
    return {
      schedule,
      dependencies: this.dependencyGraph.dependenciesOf(scheduleId),
      history: this.history.get(scheduleId) ?? [],
      activeWindows: this.graph.activeWindowsAt(this.now()),
      delayReasons: this.graph.whyDelayed(scheduleId),
    };
  }

  getMetrics(): SchedulingMetrics {
    return {
      scheduledJobs: this.scheduledJobs,
      successfulExecutions: this.successfulExecutions,
      failedExecutions: this.failedExecutions,
      delayedExecutions: this.delayedExecutions,
      retryCount: this.retryCount,
      averageSchedulingLatencyMs: average(this.schedulingDurations),
      averageExecutionLatencyMs: average(this.executionDurations),
    };
  }

  // ---- Internal ----

  private async publish(name: string, payload: unknown): Promise<void> {
    if (this.eventBus) {
      await this.eventBus.publish(name, PUBLISHER_AUTHORITY, payload);
    }
    this.logOnly(name, payload);
  }

  /** §17 — reporting into IOLA must never itself block or fail scheduling;
   * a schema mismatch (Law 2) is swallowed, not propagated. */
  private logOnly(operation: string, payload: unknown): void {
    if (!this.observability) return;
    try {
      this.observability.log({
        severity: operation === SCHEDULE_EVENTS.ScheduleFailed ? 'error' : 'information',
        category: LOG_CATEGORY,
        authority: PUBLISHER_AUTHORITY,
        operation,
        message: operation,
        context: payload as Record<string, unknown>,
      });
    } catch {
      // Observability is a diagnostic concern, never a functional dependency.
    }
  }
}
