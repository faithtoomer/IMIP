import { describe, expect, it, vi } from 'vitest';
import { RESOURCE_EVENTS } from '../src/events.js';
import { ResourceEventBus } from '../src/events.js';
import { makeAuthority, syncDefault } from './testHelpers.js';

describe('Resource events', () => {
  it('ResourceEventBus publishes and subscribes', () => {
    const bus = new ResourceEventBus();
    const handler = vi.fn();
    const unsub = bus.subscribe(RESOURCE_EVENTS.ResourceRegistered, handler);
    bus.publish(RESOURCE_EVENTS.ResourceRegistered, { resourceId: 'test' });
    expect(handler).toHaveBeenCalledWith({ resourceId: 'test' });
    unsub();
    bus.publish(RESOURCE_EVENTS.ResourceRegistered, { resourceId: 'again' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('sync publishes ResourceRegistered and ResourceAvailable', async () => {
    const authority = makeAuthority();
    const registered = vi.fn();
    const available = vi.fn();
    authority.subscribe(RESOURCE_EVENTS.ResourceRegistered, registered);
    authority.subscribe(RESOURCE_EVENTS.ResourceAvailable, available);
    await syncDefault(authority);
    expect(registered).toHaveBeenCalled();
    expect(available).toHaveBeenCalled();
  });

  it('allocation publishes ResourceAllocated and ResourceOwnershipChanged', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);
    const allocated = vi.fn();
    const ownershipChanged = vi.fn();
    authority.subscribe(RESOURCE_EVENTS.ResourceAllocated, allocated);
    authority.subscribe(RESOURCE_EVENTS.ResourceOwnershipChanged, ownershipChanged);
    authority.requestAllocation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'w',
      requestingAuthority: 'Workload Authority',
      mode: 'exclusive',
      capacity: 100,
    });
    expect(allocated).toHaveBeenCalled();
    expect(ownershipChanged).toHaveBeenCalled();
  });

  it('reservation publishes ResourceReserved', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);
    const reserved = vi.fn();
    authority.subscribe(RESOURCE_EVENTS.ResourceReserved, reserved);
    authority.requestReservation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'w',
      requestingAuthority: 'Workload Authority',
      capacity: 30,
    });
    expect(reserved).toHaveBeenCalled();
  });

  it('release publishes ResourceReleased', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);
    const allocation = authority.requestAllocation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'w',
      requestingAuthority: 'Workload Authority',
      mode: 'exclusive',
      capacity: 100,
    });
    const released = vi.fn();
    authority.subscribe(RESOURCE_EVENTS.ResourceReleased, released);
    authority.release('hw-gpu-001:gpu', {
      allocationId: allocation.id,
      reason: 'done',
      initiatingAuthority: 'Workload Authority',
    });
    expect(released).toHaveBeenCalled();
  });

  it('expireReservations publishes ResourceReservationExpired', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);
    authority.requestReservation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'w',
      requestingAuthority: 'Workload Authority',
      capacity: 30,
      expiresAt: '2026-08-08T11:00:00.000Z',
    });
    const expired = vi.fn();
    authority.subscribe(RESOURCE_EVENTS.ResourceReservationExpired, expired);
    authority.expireReservations();
    expect(expired).toHaveBeenCalled();
  });
});
