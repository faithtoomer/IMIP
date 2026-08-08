import { describe, expect, it } from 'vitest';
import { HardwareAuthority } from '../src/HardwareAuthority.js';
import { FakeDiscoveryProvider } from './testHelpers.js';

/** §9 Digital Twin "Allocation: current ownership" — genuinely new field, not
 * present when Phase 03 shipped. */
describe('Allocation tracking', () => {
  it('allocate() records who the device is allocated to', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];
    authority.recordBenchmark({ deviceId: gpu.deviceId, workload: 'gpu-mining', metric: 'H/s', value: 4200, unit: 'H/s', recordedAt: new Date().toISOString() });

    const allocated = authority.allocate(gpu.deviceId, 'monero-plugin', 'assigned to monero mining', 'Mining Authority');

    expect(allocated.allocation).toEqual({
      ownerId: 'monero-plugin',
      ownerAuthority: 'Mining Authority',
      allocatedAt: expect.any(String),
      reason: 'assigned to monero mining',
    });
    expect(allocated.lifecycleStage).toBe('allocated');
  });

  it('releaseAllocation() clears the ownership record', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];
    authority.recordBenchmark({ deviceId: gpu.deviceId, workload: 'gpu-mining', metric: 'H/s', value: 4200, unit: 'H/s', recordedAt: new Date().toISOString() });
    authority.allocate(gpu.deviceId, 'monero-plugin', 'assigned', 'Mining Authority');

    const released = authority.releaseAllocation(gpu.deviceId, 'unassigned', 'Mining Authority');

    expect(released.allocation).toBeUndefined();
    expect(released.lifecycleStage).toBe('released');
  });

  it('the Digital Twin reflects the current allocation', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];
    authority.recordBenchmark({ deviceId: gpu.deviceId, workload: 'gpu-mining', metric: 'H/s', value: 4200, unit: 'H/s', recordedAt: new Date().toISOString() });
    authority.allocate(gpu.deviceId, 'monero-plugin', 'assigned', 'Mining Authority');

    const twin = authority.getDigitalTwin(gpu.deviceId);
    expect(twin.allocation?.ownerId).toBe('monero-plugin');
  });

  it('a freshly discovered, unallocated device has no allocation record', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];
    expect(gpu.allocation).toBeUndefined();
    expect(authority.getDigitalTwin(gpu.deviceId).allocation).toBeUndefined();
  });
});
