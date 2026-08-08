import { describe, expect, it, vi } from 'vitest';
import { WORKLOAD_EVENTS, WorkloadEventBus, type WorkloadEventName } from '../src/events.js';
import { assignAndStart, makeAuthority, makeRequest, validatedQueued } from './testHelpers.js';

describe('Workload events', () => {
  it('WorkloadEventBus publishes and unsubscribes', () => {
    const bus = new WorkloadEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe(WORKLOAD_EVENTS.WorkloadCreated, handler);
    bus.publish(WORKLOAD_EVENTS.WorkloadCreated, { workloadId: 'w-1' });
    expect(handler).toHaveBeenCalledWith({ workloadId: 'w-1' });
    unsubscribe();
    bus.publish(WORKLOAD_EVENTS.WorkloadCreated, { workloadId: 'w-2' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('publishes created, queued, assigned, started, paused, completed, and forecast events', () => {
    const authority = makeAuthority();
    const handlers = Object.fromEntries(
      [
        WORKLOAD_EVENTS.WorkloadCreated, WORKLOAD_EVENTS.WorkloadQueued, WORKLOAD_EVENTS.WorkloadAssigned,
        WORKLOAD_EVENTS.WorkloadStarted, WORKLOAD_EVENTS.WorkloadPaused, WORKLOAD_EVENTS.WorkloadCompleted,
        WORKLOAD_EVENTS.WorkloadForecastUpdated,
      ].map((event) => [event, vi.fn()]),
    ) as Record<string, ReturnType<typeof vi.fn>>;
    for (const [event, handler] of Object.entries(handlers)) authority.subscribe(event as WorkloadEventName, handler);

    const id = authority.createWorkload(makeRequest()).workloadId;
    authority.validate(id);
    authority.queue(id);
    authority.markAssigned(id, [{ resourceId: 'r-1', confirmedBy: 'IRIA' }]);
    authority.start(id);
    authority.pause(id);
    authority.start(id);
    authority.updateForecast(id);
    authority.complete(id);

    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalled();
  });

  it('publishes failed and cancelled events on their distinct outcomes', () => {
    const authority = makeAuthority();
    const failed = vi.fn();
    const cancelled = vi.fn();
    authority.subscribe(WORKLOAD_EVENTS.WorkloadFailed, failed);
    authority.subscribe(WORKLOAD_EVENTS.WorkloadCancelled, cancelled);
    const failedId = assignAndStart(authority);
    authority.fail(failedId, 'worker unavailable');
    const cancelledId = authority.createWorkload(makeRequest({ workloadId: 'cancelled' })).workloadId;
    authority.cancel(cancelledId, 'request withdrawn');
    expect(failed).toHaveBeenCalledWith(expect.objectContaining({ workloadId: failedId }));
    expect(cancelled).toHaveBeenCalledWith(expect.objectContaining({ workloadId: cancelledId }));
  });

  it('telemetry refresh publishes an updated forecast', () => {
    const authority = makeAuthority();
    const forecast = vi.fn();
    authority.subscribe(WORKLOAD_EVENTS.WorkloadForecastUpdated, forecast);
    const id = authority.createWorkload(makeRequest()).workloadId;
    authority.recordTelemetry({ workloadId: id, recordedAt: '2026-08-08T12:00:01.000Z', resourceUsage: {}, throughput: 10 });
    expect(forecast).toHaveBeenCalledTimes(1);
  });
});
