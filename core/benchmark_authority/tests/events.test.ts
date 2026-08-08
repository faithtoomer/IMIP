import { describe, expect, it, vi } from 'vitest';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { BENCHMARK_EVENTS, BenchmarkEventBus, type BenchmarkEventName } from '../src/events.js';
import { FakeIHISBenchmarkRegistry, completeToStored, makeAuthority, makeInput } from './testHelpers.js';

describe('IBIA benchmark events', () => {
  it('publishes and unsubscribes from the local benchmark event surface', () => {
    const bus = new BenchmarkEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe(BENCHMARK_EVENTS.BenchmarkCompleted, handler);
    bus.publish(BENCHMARK_EVENTS.BenchmarkCompleted, { runId: 'r-1' });
    unsubscribe();
    bus.publish(BENCHMARK_EVENTS.BenchmarkCompleted, { runId: 'r-2' });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ runId: 'r-1' });
  });

  it('publishes all specified events and mirrors them in the benchmark EventCategory', async () => {
    const institutional = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const authority = makeAuthority({ eventBus: institutional, providers: { hardwareStore: new FakeIHISBenchmarkRegistry() } });
    const handlers = Object.fromEntries(Object.values(BENCHMARK_EVENTS).map((event) => [event, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>;
    for (const [event, handler] of Object.entries(handlers)) authority.subscribe(event as BenchmarkEventName, handler);
    const baseline = completeToStored(authority, makeInput(), 100);
    authority.compare(baseline.runId);
    authority.archive(baseline.runId);
    const regressed = completeToStored(authority, makeInput(), 80);
    authority.compare(regressed.runId);
    const failure = authority.create(makeInput({ deviceId: 'gpu-002' }));
    authority.fail(failure.runId, 'External test failure.');
    await authority.events.flushMirror();
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalled();
    expect(institutional.getEventDefinitions('benchmark').map((definition) => definition.name)).toEqual(expect.arrayContaining(Object.values(BENCHMARK_EVENTS)));
    expect(institutional.getEventHistory().every((event) => event.eventType in handlers)).toBe(true);
  });
});
