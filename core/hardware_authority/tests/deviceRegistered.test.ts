import { describe, expect, it } from 'vitest';
import { HardwareAuthority } from '../src/HardwareAuthority.js';
import { HARDWARE_EVENTS } from '../src/events.js';
import { FakeDiscoveryProvider } from './testHelpers.js';

describe('DeviceRegistered event (§12)', () => {
  it('fires once per newly discovered device, before Discovered', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    const order: string[] = [];
    authority.subscribe(HARDWARE_EVENTS.DeviceRegistered, () => order.push('registered'));
    authority.subscribe(HARDWARE_EVENTS.Discovered, () => order.push('discovered'));

    await authority.discover();

    expect(order.length).toBeGreaterThan(0);
    expect(order[0]).toBe('registered');
    expect(order[1]).toBe('discovered');
  });

  it('does not fire again on re-discovery of an already-registered device', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();

    const registrations: unknown[] = [];
    authority.subscribe(HARDWARE_EVENTS.DeviceRegistered, (p) => registrations.push(p));
    await authority.discover();

    expect(registrations).toEqual([]);
  });

  it('carries the deviceId in its payload', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    const payloads: unknown[] = [];
    authority.subscribe(HARDWARE_EVENTS.DeviceRegistered, (p) => payloads.push(p));

    await authority.discover();
    const gpuId = authority.getCategory('gpu')[0].deviceId;

    expect(payloads).toContainEqual({ deviceId: gpuId });
  });
});
