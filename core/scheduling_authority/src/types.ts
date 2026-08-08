import type { EventPriority } from '../../event_bus/src/index.js';

/** §6 — the six schedule types. */
export type ScheduleType = 'time' | 'event' | 'policy' | 'conditional' | 'manual' | 'ai-recommendation';

export interface EvaluationContext {
  now: Date;
}

export interface TimeTrigger {
  kind: 'time';
  intervalMs?: number;
  dailyAt?: { hour: number; minute: number };
  weeklyAt?: { dayOfWeek: number; hour: number; minute: number };
  /** One-shot ISO timestamp. A missed one-shot trigger cannot be rescheduled
   * to "next occurrence" the way a recurring trigger can — see
   * SchedulingAuthority.tick()'s Delayed-vs-Skipped distinction. */
  at?: string;
}

export interface EventTrigger {
  kind: 'event';
  eventName: string;
}

/** §6 — "Electricity below threshold", "Mining window active", etc. Backed
 * by the shared PolicyEvaluator gate every schedule already goes through —
 * a policyId doesn't need its own signaling path. */
export interface PolicyTrigger {
  kind: 'policy';
  policyId: string;
}

export interface ConditionalTrigger {
  kind: 'conditional';
  description: string;
  evaluate: (context: EvaluationContext) => boolean;
}

export interface ManualTrigger {
  kind: 'manual';
}

/** §6 — "Recommendations only. Policies remain authoritative." An AI
 * recommendation can only make a schedule eligible to be checked; it is
 * still subject to the same real PolicyEvaluator/ResourceEvaluator gate as
 * every other trigger kind (see notifyRecommendation()). */
export interface AiRecommendationTrigger {
  kind: 'ai-recommendation';
  minConfidence?: number;
}

export type ScheduleTrigger = TimeTrigger | EventTrigger | PolicyTrigger | ConditionalTrigger | ManualTrigger | AiRecommendationTrigger;

export type RetryStrategy = 'immediate' | 'fixed-interval' | 'exponential-backoff' | 'manual';

export interface RetryPolicy {
  strategy: RetryStrategy;
  maxAttempts?: number;
  intervalMs?: number;
  backoffMultiplier?: number;
}

/** §8, extended beyond the spec's literal 9-node diagram with `paused`,
 * `cancelled`, and `failed` — required for §12 (retry) and §15
 * (pause/resume/cancel) to be real rather than fabricated. See ADR-0014. */
export type ScheduleStatus =
  | 'created'
  | 'validated'
  | 'registered'
  | 'eligible'
  | 'scheduled'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rescheduled'
  | 'paused'
  | 'cancelled'
  | 'retired';

/** §7 — the authoritative registry entry. `requiredRuntimeState` refers to
 * the platform-level RuntimeState (`core/runtime_bootstrap`), not Hardware
 * Authority's unrelated, identically-named per-device RuntimeState — see
 * ADR-0014 for why both exist. */
export interface ScheduleDefinition {
  scheduleId: string;
  name: string;
  description: string;
  ownerAuthority: string;
  scheduleType: ScheduleType;
  trigger: ScheduleTrigger;
  dependencies: string[];
  requiredRuntimeState?: string[];
  /** Hardware Authority deviceIds — checked by the real, non-fabricated
   * `hardwareResourceEvaluator` (evaluators.ts) when configured. */
  requiredDevices?: string[];
  /** Policy Authority policyIds — checked by whatever PolicyEvaluator is
   * configured; permissive by default until Policy Authority exists. */
  requiredPolicies?: string[];
  priority: EventPriority;
  retryPolicy?: RetryPolicy;
  timeoutMs?: number;
  status: ScheduleStatus;
  createdAt: string;
  lastExecutionAt?: string;
  nextExecutionAt?: string;
}

export type ScheduleInput = Pick<ScheduleDefinition, 'name' | 'ownerAuthority' | 'scheduleType' | 'trigger'> &
  Partial<
    Pick<
      ScheduleDefinition,
      'description' | 'dependencies' | 'requiredRuntimeState' | 'requiredDevices' | 'requiredPolicies' | 'priority' | 'retryPolicy' | 'timeoutMs'
    >
  >;

export type ExecutionResult = 'success' | 'failure' | 'skipped';

export interface ExecutionRecord {
  executionId: string;
  scheduleId: string;
  attempt: number;
  startedAt: string;
  completedAt?: string;
  result: ExecutionResult;
  delayReasons: string[];
  error?: string;
}

export interface ExecutionContext {
  schedule: ScheduleDefinition;
  attempt: number;
  triggeredBy: 'time' | 'event' | 'policy' | 'conditional' | 'manual' | 'ai-recommendation';
}

export interface ExecutionOutcome {
  success: boolean;
  message?: string;
}

/** §5/§4 — ISOA never contains mining/decision/hardware logic itself; every
 * registered schedule supplies its own handler, the same generic-contract
 * pattern IRBLM's ComponentDefinition uses for authorities. */
export interface ScheduleExecutionHandler {
  execute(context: ExecutionContext): Promise<ExecutionOutcome>;
}

export interface PolicyEvaluationResult {
  approved: boolean;
  reasons: string[];
}

export interface PolicyEvaluator {
  evaluate(schedule: ScheduleDefinition, context: EvaluationContext): PolicyEvaluationResult;
}

export interface ResourceEvaluationResult {
  available: boolean;
  reasons: string[];
}

export interface ResourceEvaluator {
  evaluate(schedule: ScheduleDefinition, context: EvaluationContext): ResourceEvaluationResult;
}

export interface TickResult {
  evaluatedAt: string;
  executed: string[];
  skipped: { scheduleId: string; reasons: string[] }[];
  failed: { scheduleId: string; error: string }[];
}

export interface SchedulingMetrics {
  scheduledJobs: number;
  successfulExecutions: number;
  failedExecutions: number;
  delayedExecutions: number;
  retryCount: number;
  averageSchedulingLatencyMs: number;
  averageExecutionLatencyMs: number;
}

/** §22 — a window in the Institutional Time Graph. `maintenance` windows
 * are real and ISOA-owned; `pricing`/`opportunity` windows (and any other
 * caller-defined type) are a real, generic registration mechanism with no
 * producer wired in yet — Power/Profitability Authority don't exist. */
export type TimeWindowType = 'maintenance' | 'pricing' | 'opportunity' | (string & {});

export interface TimeWindow {
  windowId: string;
  type: TimeWindowType;
  label: string;
  startsAt: string;
  endsAt: string;
  source: string;
  /** Whether an active instance of this window blocks scheduling. Defaults
   * are the caller's choice; ISOA doesn't assume every window type blocks. */
  blocksExecution: boolean;
}

/** §13 — the 11 named events. */
export const SCHEDULE_EVENTS = {
  ScheduleCreated: 'ScheduleCreated',
  ScheduleValidated: 'ScheduleValidated',
  ScheduleRegistered: 'ScheduleRegistered',
  ScheduleTriggered: 'ScheduleTriggered',
  ScheduleDelayed: 'ScheduleDelayed',
  ScheduleSkipped: 'ScheduleSkipped',
  ScheduleStarted: 'ScheduleStarted',
  ScheduleCompleted: 'ScheduleCompleted',
  ScheduleFailed: 'ScheduleFailed',
  ScheduleRetried: 'ScheduleRetried',
  ScheduleCancelled: 'ScheduleCancelled',
} as const;

export type ScheduleEventName = (typeof SCHEDULE_EVENTS)[keyof typeof SCHEDULE_EVENTS];
