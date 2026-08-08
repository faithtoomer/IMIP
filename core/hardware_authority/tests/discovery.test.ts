import { describe, expect, it } from 'vitest';
import { HardwareAuthority } from '../src/HardwareAuthority.js';
import { HARDWARE_EVENTS } from '../src/events.js';
import { FakeDiscoveryProvider, makeRawSnapshot } from './testHelpers.js';

describe('HardwareAuthority.discover() end-to-end', () => {
  it('registers every discovered device exactly once and auto-advances new devices to available', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    const snapshot = await authority.discover();

    expect(snapshot.devices.length).toBeGreaterThan(0);
    const gpu = authority.getCategory('gpu')[0];
    expect(gpu.lifecycleStage).toBe('capability-assessed');
    expect(gpu.runtimeState).toBe('available');
  });

  it('publishes HardwareDiscovered for every new device on first discovery', async () => {
    const provider = new FakeDiscoveryProvider();
    const authority = new HardwareAuthority({ discoveryProvider: provider });
    const discovered: unknown[] = [];
    authority.subscribe(HARDWARE_EVENTS.Discovered, (payload) => discovered.push(payload));

    await authority.discover();
    expect(discovered.length).toBe(authority.getInventory().length);
  });

  it('re-discovering identical hardware updates rather than duplicates', async () => {
    const provider = new FakeDiscoveryProvider();
    const authority = new HardwareAuthority({ discoveryProvider: provider });
    await authority.discover();
    const countAfterFirst = authority.getInventory().length;

    await authority.discover();
    expect(authority.getInventory().length).toBe(countAfterFirst);
  });

  it('publishes HardwareUpdated (not HardwareDiscovered) on re-discovery of an unchanged device', async () => {
    const provider = new FakeDiscoveryProvider();
    const authority = new HardwareAuthority({ discoveryProvider: provider });
    await authority.discover();

    const discovered: unknown[] = [];
    const updated: unknown[] = [];
    authority.subscribe(HARDWARE_EVENTS.Discovered, (p) => discovered.push(p));
    authority.subscribe(HARDWARE_EVENTS.Updated, (p) => updated.push(p));

    await authority.discover();
    expect(discovered).toEqual([]);
    expect(updated.length).toBeGreaterThan(0);
  });

  it('publishes CapabilityChanged when a device gains a capability across discoveries', async () => {
    const provider = new FakeDiscoveryProvider(makeRawSnapshot({ gpu: [{ vendor: 'Intel', model: 'Iris Xe', vramMB: 1024 }] }));
    const authority = new HardwareAuthority({ discoveryProvider: provider });
    await authority.discover();

    const changes: unknown[] = [];
    authority.subscribe(HARDWARE_EVENTS.CapabilityChanged, (p) => changes.push(p));

    provider.setSnapshot(makeRawSnapshot({ gpu: [{ vendor: 'Intel', model: 'Iris Xe', vramMB: 8192, temperatureCelsius: 60 }] }));
    await authority.discover();

    expect(changes.length).toBe(1);
  });

  it('publishes DriverChanged when a device driver version changes', async () => {
    const provider = new FakeDiscoveryProvider(makeRawSnapshot({ gpu: [{ vendor: 'NVIDIA', model: 'RTX 4080', vramMB: 16384, driverVersion: '550.00' }] }));
    const authority = new HardwareAuthority({ discoveryProvider: provider });
    await authority.discover();

    const driverChanges: unknown[] = [];
    authority.subscribe(HARDWARE_EVENTS.DriverChanged, (p) => driverChanges.push(p));

    provider.setSnapshot(makeRawSnapshot({ gpu: [{ vendor: 'NVIDIA', model: 'RTX 4080', vramMB: 16384, driverVersion: '551.23' }] }));
    await authority.discover();

    expect(driverChanges).toEqual([{ deviceId: expect.any(String), from: '550.00', to: '551.23' }]);
  });

  it('marks a device offline and publishes HardwareRemoved when it disappears from discovery', async () => {
    const provider = new FakeDiscoveryProvider(makeRawSnapshot());
    const authority = new HardwareAuthority({ discoveryProvider: provider });
    await authority.discover();
    const gpuId = authority.getCategory('gpu')[0].deviceId;

    const removed: unknown[] = [];
    authority.subscribe(HARDWARE_EVENTS.Removed, (p) => removed.push(p));

    provider.setSnapshot(makeRawSnapshot({ gpu: [] }));
    await authority.discover();

    expect(removed).toEqual([{ deviceId: gpuId }]);
    expect(authority.getDevice(gpuId).runtimeState).toBe('offline');
  });

  it('preserves previous inventory for a category that fails discovery, rather than treating devices as removed', async () => {
    const provider = new FakeDiscoveryProvider(makeRawSnapshot());
    const authority = new HardwareAuthority({ discoveryProvider: provider });
    await authority.discover();
    const gpuId = authority.getCategory('gpu')[0].deviceId;

    provider.setSnapshot(makeRawSnapshot({ gpu: [] }));
    provider.setFailures([{ category: 'gpu', message: 'gpu discovery failed: driver unavailable' }]);

    const removed: unknown[] = [];
    const faults: unknown[] = [];
    authority.subscribe(HARDWARE_EVENTS.Removed, (p) => removed.push(p));
    authority.subscribe(HARDWARE_EVENTS.HardwareFaultDetected, (p) => faults.push(p));

    await authority.discover();

    expect(removed).toEqual([]); // not treated as removed — the category itself failed
    expect(faults.length).toBe(1);
    expect(authority.getDevice(gpuId)).toBeDefined(); // still present
  });

  it('increments the discovery snapshot version and retains history', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    const first = await authority.discover();
    const second = await authority.discover();
    expect(second.version).toBe(first.version + 1);
    expect(authority.getDiscoveryHistory()).toHaveLength(2);
  });

  it('discovery snapshots are immutable (Law 3)', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    const snapshot = await authority.discover();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.devices)).toBe(true);
  });
});
