import { describe, expect, it } from 'vitest';
import { HardwareAuthority } from '../src/HardwareAuthority.js';
import { HARDWARE_EVENTS } from '../src/events.js';
import { FakeDiscoveryProvider, makeRawSnapshot } from './testHelpers.js';

describe('IHIS events (§12)', () => {
  it('publishes DeviceReserved on reserve() and DeviceReleased + DeviceAvailable on releaseReservation()', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    const seen: string[] = [];
    authority.subscribe(HARDWARE_EVENTS.DeviceReserved, () => seen.push('reserved'));
    authority.subscribe(HARDWARE_EVENTS.DeviceReleased, () => seen.push('released'));
    authority.subscribe(HARDWARE_EVENTS.DeviceAvailable, () => seen.push('available'));

    authority.reserve(gpu.deviceId, 'test', 'Mining Authority');
    authority.releaseReservation(gpu.deviceId, 'test', 'Mining Authority');

    expect(seen).toEqual(['reserved', 'released', 'available']);
  });

  it('publishes BenchmarkCompleted on recordBenchmark()', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    let payload: unknown;
    authority.subscribe(HARDWARE_EVENTS.BenchmarkCompleted, (p) => {
      payload = p;
    });

    authority.recordBenchmark({ deviceId: gpu.deviceId, workload: 'gpu-mining', metric: 'H/s', value: 4200, unit: 'H/s', recordedAt: new Date().toISOString() });

    expect(payload).toEqual({ deviceId: gpu.deviceId, workload: 'gpu-mining' });
  });

  it('publishes HardwareFaultDetected on recordFault()', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    let payload: unknown;
    authority.subscribe(HARDWARE_EVENTS.HardwareFaultDetected, (p) => {
      payload = p;
    });

    authority.recordFault(gpu.deviceId, 'overheating', 'Hardware Authority');
    expect(payload).toEqual({ deviceId: gpu.deviceId, reason: 'overheating' });
  });

  it('subscribe() returns a working unsubscribe function', async () => {
    const provider = new FakeDiscoveryProvider();
    const authority = new HardwareAuthority({ discoveryProvider: provider });
    let count = 0;
    const unsubscribe = authority.subscribe(HARDWARE_EVENTS.Discovered, () => {
      count += 1;
    });

    await authority.discover();
    const afterFirst = count;
    expect(afterFirst).toBeGreaterThan(0);

    unsubscribe();
    provider.setSnapshot(makeRawSnapshot({ gpu: [{ vendor: 'AMD', model: 'RX 9000', vramMB: 20480 }] }));
    await authority.discover(); // a genuinely new device would normally fire Discovered again

    expect(count).toBe(afterFirst); // unsubscribed — no further increments
  });
});
