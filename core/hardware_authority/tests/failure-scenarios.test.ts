import { describe, expect, it } from 'vitest';
import { HardwareAuthority } from '../src/HardwareAuthority.js';
import { HardwareStateTransitionError, HardwareLifecycleError } from '../src/errors.js';
import { FakeDiscoveryProvider, makeRawSnapshot } from './testHelpers.js';

describe('failure handling (§15 — never crash on a single hardware failure)', () => {
  it('a fully-failed discovery (every category) still returns a valid, empty-devices-preserved snapshot', async () => {
    const provider = new FakeDiscoveryProvider(makeRawSnapshot());
    const authority = new HardwareAuthority({ discoveryProvider: provider });
    await authority.discover();
    const before = authority.getInventory().length;

    provider.setFailures([
      { category: 'cpu', message: 'cpu discovery failed: x' },
      { category: 'gpu', message: 'gpu discovery failed: x' },
      { category: 'memory', message: 'memory discovery failed: x' },
      { category: 'storage', message: 'storage discovery failed: x' },
      { category: 'motherboard', message: 'motherboard discovery failed: x' },
      { category: 'network', message: 'network discovery failed: x' },
    ]);
    provider.setSnapshot(makeRawSnapshot({ cpu: [], gpu: [], memory: null, storage: [], motherboard: null, network: [] }));

    const snapshot = await authority.discover();
    expect(snapshot).toBeDefined();
    expect(authority.getInventory().length).toBe(before); // nothing lost
  });

  it('getDevice() throws for an unknown device id', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    expect(() => authority.getDevice('does-not-exist')).toThrow(/Unknown device/);
  });

  it('reserve() on an already-reserved device is a no-op transition, not an error', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];
    authority.reserve(gpu.deviceId, 'first', 'Mining Authority');
    expect(() => authority.reserve(gpu.deviceId, 'second', 'Mining Authority')).not.toThrow();
  });

  it('markState() rejects an illegal transition', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];
    authority.markState(gpu.deviceId, 'benchmarking', 'test', 'Hardware Authority');
    expect(() => authority.markState(gpu.deviceId, 'offline', 'test', 'Hardware Authority')).toThrow(HardwareStateTransitionError);
  });

  it('allocate() before a device reaches lifecycle "available" is rejected', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0]; // sits at 'capability-assessed', no benchmark recorded yet
    expect(() => authority.allocate(gpu.deviceId, 'test', 'Mining Authority')).toThrow(HardwareLifecycleError);
  });

  it('recordFault() then recordRecovery() correctly sequences faulted -> maintenance, never straight to available', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    authority.recordFault(gpu.deviceId, 'crash', 'Hardware Authority');
    authority.recordRecovery(gpu.deviceId, 'reinstalled driver', 'Hardware Authority');

    expect(authority.getState(gpu.deviceId)).toBe('maintenance');
  });
});
