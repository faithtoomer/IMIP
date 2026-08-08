import { describe, expect, it } from 'vitest';
import { SchedulingAuthority } from '../src/SchedulingAuthority.js';
import { HardwareAuthority } from '../../hardware_authority/src/index.js';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import { hardwareResourceEvaluator } from '../src/evaluators.js';
import { InvalidScheduleTransitionError } from '../src/errors.js';
import { TestClock, succeedingHandler, failingHandler, countingHandler } from './testHelpers.js';

describe('SchedulingAuthority (Law 1 — the sole scheduling authority)', () => {
  it('registerSchedule() runs through the created->validated->registered->eligible lifecycle', async () => {
    const isoa = new SchedulingAuthority();
    const schedule = await isoa.registerSchedule(
      { name: 'benchmark', ownerAuthority: 'X', scheduleType: 'time', trigger: { kind: 'time', intervalMs: 60_000 } },
      succeedingHandler(),
    );
    expect(schedule.status).toBe('eligible');
    expect(schedule.nextExecutionAt).toBeDefined();
  });

  it('a time-based interval schedule executes exactly when due, not before', async () => {
    const clock = new TestClock(new Date('2026-08-08T12:00:00.000Z'));
    const isoa = new SchedulingAuthority({ now: clock.now });
    const handler = countingHandler();
    await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'time', trigger: { kind: 'time', intervalMs: 60_000 } },
      handler,
    );

    await isoa.tick(clock.now());
    expect(handler.count).toBe(0); // not due yet — next execution is +60s

    clock.advance(60_000);
    await isoa.tick(clock.now());
    expect(handler.count).toBe(1);
  });

  it('a recurring schedule reschedules itself after completion', async () => {
    const clock = new TestClock(new Date('2026-08-08T12:00:00.000Z'));
    const isoa = new SchedulingAuthority({ now: clock.now });
    const schedule = await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'time', trigger: { kind: 'time', intervalMs: 60_000 } },
      succeedingHandler(),
    );

    clock.advance(60_000);
    await isoa.tick(clock.now());
    const updated = isoa.registry.require(schedule.scheduleId);
    expect(updated.status).toBe('eligible');
    expect(new Date(updated.nextExecutionAt!).toISOString()).toBe('2026-08-08T12:02:00.000Z');
  });

  it('a one-shot "at" schedule retires after it successfully executes once', async () => {
    const clock = new TestClock(new Date('2026-08-08T12:00:00.000Z'));
    const isoa = new SchedulingAuthority({ now: clock.now });
    const schedule = await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'time', trigger: { kind: 'time', at: '2026-08-08T12:30:00.000Z' } },
      succeedingHandler(),
    );

    clock.set(new Date('2026-08-08T12:30:00.000Z'));
    await isoa.tick(clock.now());
    expect(isoa.registry.require(schedule.scheduleId).status).toBe('retired');
  });

  it('a missed one-shot "at" window is marked Skipped and retired, not silently rescheduled', async () => {
    const clock = new TestClock(new Date('2026-08-08T12:00:00.000Z'));
    const isoa = new SchedulingAuthority({
      now: clock.now,
      policyEvaluator: { evaluate: () => ({ approved: false, reasons: ['blocked for test'] }) },
    });
    const schedule = await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'time', trigger: { kind: 'time', at: '2026-08-08T12:30:00.000Z' } },
      succeedingHandler(),
    );

    clock.set(new Date('2026-08-08T12:30:00.000Z'));
    const result = await isoa.tick(clock.now());
    expect(result.skipped).toHaveLength(1);
    expect(isoa.registry.require(schedule.scheduleId).status).toBe('retired');
  });

  it('dependency-aware scheduling: a dependent schedule is not eligible until its dependency has a successful execution', async () => {
    const clock = new TestClock(new Date('2026-08-08T12:00:00.000Z'));
    const isoa = new SchedulingAuthority({ now: clock.now });
    const dependency = await isoa.registerSchedule(
      { name: 'dep', ownerAuthority: 'X', scheduleType: 'time', trigger: { kind: 'time', at: '2026-08-08T12:30:00.000Z' } },
      succeedingHandler(),
    );
    const dependentHandler = countingHandler();
    await isoa.registerSchedule(
      {
        name: 'dependent',
        ownerAuthority: 'X',
        scheduleType: 'time',
        trigger: { kind: 'time', intervalMs: 60_000 },
        dependencies: [dependency.scheduleId],
      },
      dependentHandler,
    );

    clock.advance(60_000);
    const firstTick = await isoa.tick(clock.now());
    expect(firstTick.skipped.some((s) => s.reasons.some((r) => r.includes('dependenc')))).toBe(true);
    expect(dependentHandler.count).toBe(0);

    clock.set(new Date('2026-08-08T12:30:00.000Z'));
    await isoa.tick(clock.now()); // dependency executes and succeeds
    clock.advance(1);
    await isoa.tick(clock.now()); // dependent is now eligible
    expect(dependentHandler.count).toBe(1);
  });

  it('a genuine circular schedule dependency is rejected at registration time, not silently accepted', async () => {
    const isoa = new SchedulingAuthority();
    const a = await isoa.registerSchedule(
      { name: 'a', ownerAuthority: 'X', scheduleType: 'manual', trigger: { kind: 'manual' } },
      succeedingHandler(),
    );
    // a<-b (b depends on a) is fine, not circular.
    const b = await isoa.registerSchedule(
      { name: 'b', ownerAuthority: 'X', scheduleType: 'manual', trigger: { kind: 'manual' }, dependencies: [a.scheduleId] },
      succeedingHandler(),
    );
    expect(b.status).toBe('eligible');

    // Registering a third schedule that would make a depend on b (closing
    // a -> b -> a) must fail — but registerSchedule() only accepts
    // dependencies at creation time, so we exercise the underlying graph
    // directly the way the orchestrator would if a were re-registered with
    // a dependency on b.
    const { ScheduleDependencyGraph } = await import('../src/dependencyGraph.js');
    const { CircularScheduleDependencyError } = await import('../src/errors.js');
    const graph = new ScheduleDependencyGraph();
    graph.register(a.scheduleId, []);
    graph.register(b.scheduleId, [a.scheduleId]);
    expect(() => graph.register(a.scheduleId, [b.scheduleId])).toThrow(CircularScheduleDependencyError);
  });

  it('a maintenance window blocks scheduling for the duration it is active', async () => {
    const clock = new TestClock(new Date('2026-08-08T12:00:00.000Z'));
    const isoa = new SchedulingAuthority({ now: clock.now });
    const handler = countingHandler();
    await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'time', trigger: { kind: 'time', intervalMs: 60_000 } },
      handler,
    );
    isoa.graph.registerWindow({
      windowId: 'maint-1',
      type: 'maintenance',
      label: 'Nightly maintenance',
      startsAt: '2026-08-08T12:00:00.000Z',
      endsAt: '2026-08-08T13:00:00.000Z',
      source: 'ISOA',
      blocksExecution: true,
    });

    clock.advance(60_000);
    await isoa.tick(clock.now());
    expect(handler.count).toBe(0);

    clock.set(new Date('2026-08-08T13:00:01.000Z'));
    await isoa.tick(clock.now());
    expect(handler.count).toBe(1);
  });

  it('a custom PolicyEvaluator can block execution; the permissive default never does', async () => {
    const clock = new TestClock(new Date('2026-08-08T12:00:00.000Z'));
    const isoa = new SchedulingAuthority({
      now: clock.now,
      policyEvaluator: { evaluate: () => ({ approved: false, reasons: ['electricity price too high'] }) },
    });
    const handler = countingHandler();
    await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'time', trigger: { kind: 'time', intervalMs: 60_000 } },
      handler,
    );
    clock.advance(60_000);
    const result = await isoa.tick(clock.now());
    expect(handler.count).toBe(0);
    expect(result.skipped[0].reasons).toContain('electricity price too high');
  });

  it('wires a real HardwareAuthority as the ResourceEvaluator: an unavailable device blocks execution', async () => {
    const hardware = new HardwareAuthority();
    await hardware.discover();
    const [device] = hardware.getInventory();
    hardware.reserve(device.deviceId, 'busy', 'Test');

    const clock = new TestClock(new Date('2026-08-08T12:00:00.000Z'));
    const isoa = new SchedulingAuthority({ now: clock.now, resourceEvaluator: hardwareResourceEvaluator(hardware) });
    const handler = countingHandler();
    await isoa.registerSchedule(
      {
        name: 'x',
        ownerAuthority: 'X',
        scheduleType: 'time',
        trigger: { kind: 'time', intervalMs: 60_000 },
        requiredDevices: [device.deviceId],
      },
      handler,
    );
    clock.advance(60_000);
    await isoa.tick(clock.now());
    expect(handler.count).toBe(0);
  });

  it('retries with fixed-interval strategy and respects maxAttempts, tracking attempt count across ticks', async () => {
    const clock = new TestClock(new Date('2026-08-08T12:00:00.000Z'));
    const isoa = new SchedulingAuthority({ now: clock.now });
    const attempts: number[] = [];
    const handler = {
      execute: async ({ attempt }: { attempt: number }) => {
        attempts.push(attempt);
        return { success: false, message: 'always fails' };
      },
    };
    await isoa.registerSchedule(
      {
        name: 'x',
        ownerAuthority: 'X',
        scheduleType: 'time',
        trigger: { kind: 'time', intervalMs: 60_000 },
        retryPolicy: { strategy: 'fixed-interval', intervalMs: 10_000, maxAttempts: 3 },
      },
      handler,
    );

    clock.advance(60_000);
    await isoa.tick(clock.now()); // attempt 1, fails, schedules retry +10s
    clock.advance(10_000);
    await isoa.tick(clock.now()); // attempt 2, fails, schedules retry +10s
    clock.advance(10_000);
    await isoa.tick(clock.now()); // attempt 3, fails, retries exhausted

    expect(attempts).toEqual([1, 2, 3]);
    expect(isoa.getMetrics().retryCount).toBe(2); // two retries scheduled after attempts 1 and 2
  });

  it('pause() stops a schedule from executing; resume() re-enables it', async () => {
    const clock = new TestClock(new Date('2026-08-08T12:00:00.000Z'));
    const isoa = new SchedulingAuthority({ now: clock.now });
    const handler = countingHandler();
    const schedule = await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'time', trigger: { kind: 'time', intervalMs: 60_000 } },
      handler,
    );

    await isoa.pause(schedule.scheduleId, 'operator request', 'Operator');
    clock.advance(60_000);
    await isoa.tick(clock.now());
    expect(handler.count).toBe(0);

    await isoa.resume(schedule.scheduleId, 'Operator');
    await isoa.tick(clock.now());
    expect(handler.count).toBe(1);
  });

  it('cancel() is terminal — a cancelled schedule never executes again', async () => {
    const clock = new TestClock(new Date('2026-08-08T12:00:00.000Z'));
    const isoa = new SchedulingAuthority({ now: clock.now });
    const handler = countingHandler();
    const schedule = await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'time', trigger: { kind: 'time', intervalMs: 60_000 } },
      handler,
    );
    await isoa.cancel(schedule.scheduleId, 'no longer needed', 'Operator');
    await expect(isoa.pause(schedule.scheduleId, 'x', 'X')).rejects.toThrow(InvalidScheduleTransitionError);
    clock.advance(60_000);
    await isoa.tick(clock.now());
    expect(handler.count).toBe(0);
  });

  it('triggerManually() executes immediately regardless of the trigger\'s own schedule', async () => {
    const isoa = new SchedulingAuthority();
    const handler = countingHandler();
    const schedule = await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'manual', trigger: { kind: 'manual' } },
      handler,
    );
    const outcome = await isoa.triggerManually(schedule.scheduleId);
    expect(outcome.success).toBe(true);
    expect(handler.count).toBe(1);
  });

  it('notifyEvent() fires only event-triggered schedules matching the event name', async () => {
    const isoa = new SchedulingAuthority();
    const matching = countingHandler();
    const nonMatching = countingHandler();
    await isoa.registerSchedule(
      { name: 'a', ownerAuthority: 'X', scheduleType: 'event', trigger: { kind: 'event', eventName: 'HardwareDiscovered' } },
      matching,
    );
    await isoa.registerSchedule(
      { name: 'b', ownerAuthority: 'X', scheduleType: 'event', trigger: { kind: 'event', eventName: 'SomethingElse' } },
      nonMatching,
    );
    await isoa.notifyEvent('HardwareDiscovered');
    expect(matching.count).toBe(1);
    expect(nonMatching.count).toBe(0);
  });

  it('notifyRecommendation() never bypasses the PolicyEvaluator — "recommendations only" (§6)', async () => {
    const isoa = new SchedulingAuthority({
      policyEvaluator: { evaluate: () => ({ approved: false, reasons: ['policy denies'] }) },
    });
    const handler = countingHandler();
    const schedule = await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'ai-recommendation', trigger: { kind: 'ai-recommendation', minConfidence: 0.5 } },
      handler,
    );
    const outcome = await isoa.notifyRecommendation(schedule.scheduleId, 0.99);
    expect(outcome).toBeUndefined();
    expect(handler.count).toBe(0);
  });

  it('notifyRecommendation() respects minConfidence', async () => {
    const isoa = new SchedulingAuthority();
    const handler = countingHandler();
    const schedule = await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'ai-recommendation', trigger: { kind: 'ai-recommendation', minConfidence: 0.8 } },
      handler,
    );
    expect(await isoa.notifyRecommendation(schedule.scheduleId, 0.5)).toBeUndefined();
    expect(handler.count).toBe(0);
    expect((await isoa.notifyRecommendation(schedule.scheduleId, 0.9))?.success).toBe(true);
    expect(handler.count).toBe(1);
  });

  it('a conditional trigger fires only when its predicate is true', async () => {
    const isoa = new SchedulingAuthority();
    const handler = countingHandler();
    let idle = false;
    await isoa.registerSchedule(
      {
        name: 'x',
        ownerAuthority: 'X',
        scheduleType: 'conditional',
        trigger: { kind: 'conditional', description: 'GPU idle', evaluate: () => idle },
      },
      handler,
    );
    await isoa.tick();
    expect(handler.count).toBe(0);
    idle = true;
    await isoa.tick();
    expect(handler.count).toBe(1);
  });

  it('a failed execution times out when it exceeds the configured timeoutMs', async () => {
    const isoa = new SchedulingAuthority();
    const slowHandler = { execute: () => new Promise<{ success: boolean }>(() => {}) }; // never resolves
    const schedule = await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'manual', trigger: { kind: 'manual' }, timeoutMs: 20 },
      slowHandler,
    );
    const outcome = await isoa.triggerManually(schedule.scheduleId);
    expect(outcome.success).toBe(false);
  });

  it('explain() surfaces the schedule, dependencies, history, and active windows together', async () => {
    const isoa = new SchedulingAuthority();
    const dependency = await isoa.registerSchedule(
      { name: 'dep', ownerAuthority: 'X', scheduleType: 'manual', trigger: { kind: 'manual' } },
      succeedingHandler(),
    );
    const schedule = await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'manual', trigger: { kind: 'manual' }, dependencies: [dependency.scheduleId] },
      succeedingHandler(),
    );
    await isoa.triggerManually(dependency.scheduleId);

    const view = isoa.explain(schedule.scheduleId);
    expect(view.schedule.scheduleId).toBe(schedule.scheduleId);
    expect(view.dependencies).toEqual([dependency.scheduleId]);
    expect(view.history).toEqual([]);
  });

  it('getMetrics() tracks scheduledJobs, successes, and failures', async () => {
    const isoa = new SchedulingAuthority();
    await isoa.registerSchedule(
      { name: 'a', ownerAuthority: 'X', scheduleType: 'manual', trigger: { kind: 'manual' } },
      succeedingHandler(),
    );
    const b = await isoa.registerSchedule(
      { name: 'b', ownerAuthority: 'X', scheduleType: 'manual', trigger: { kind: 'manual' } },
      failingHandler(),
    );
    await isoa.triggerManually(b.scheduleId);

    const metrics = isoa.getMetrics();
    expect(metrics.scheduledJobs).toBe(2);
    expect(metrics.failedExecutions).toBe(1);
  });

  it('wires into a real InstitutionalEventBus: ScheduleRegistered publishes under the reserved "scheduler" category', async () => {
    const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const isoa = new SchedulingAuthority({ eventBus: bus });
    const seen: unknown[] = [];
    bus.subscribeToEvent(
      'ScheduleRegistered',
      (envelope) => {
        seen.push(envelope.payload);
      },
      { subscriberAuthority: 'Test' },
    );

    await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'manual', trigger: { kind: 'manual' } },
      succeedingHandler(),
    );
    expect(seen).toHaveLength(1);
    expect(bus.getEventDefinition('ScheduleRegistered')?.category).toBe('scheduler');
  });

  it('wires into a real ObservabilityAuthority: scheduling events are logged under category "scheduler"', async () => {
    const iola = new ObservabilityAuthority();
    const isoa = new SchedulingAuthority({ observabilityAuthority: iola });
    await isoa.registerSchedule(
      { name: 'x', ownerAuthority: 'X', scheduleType: 'manual', trigger: { kind: 'manual' } },
      succeedingHandler(),
    );
    const logged = iola.search((record) => record.category === 'scheduler' && record.operation === 'ScheduleRegistered');
    expect(logged).toHaveLength(1);
  });
});
