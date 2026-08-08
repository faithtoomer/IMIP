import { describe, expect, it } from 'vitest';
import { HardwareAuthority } from '../src/HardwareAuthority.js';
import { FakeDiscoveryProvider, makeRawSnapshot } from './testHelpers.js';

describe('Digital Twin & suitability scoring (Architect\'s Enhancement)', () => {
  it('a device without the requested capability scores 0 with high confidence', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const cpu = authority.getCategory('cpu')[0];

    const score = authority.getSuitability(cpu.deviceId, 'ai-training');
    expect(score.score).toBe(0);
    expect(score.confidence).toBe('high');
    expect(score.explanation[0]).toMatch(/lacks/);
  });

  it('an available, healthy, capable device scores well with medium confidence before any benchmark', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    const score = authority.getSuitability(gpu.deviceId, 'gpu-mining');
    expect(score.score).toBeGreaterThan(0.5);
    expect(score.confidence).toBe('medium');
  });

  it('recording a benchmark raises confidence to high', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    authority.recordBenchmark({ deviceId: gpu.deviceId, workload: 'gpu-mining', metric: 'H/s', value: 4200, unit: 'H/s', recordedAt: new Date().toISOString() });

    const score = authority.getSuitability(gpu.deviceId, 'gpu-mining');
    expect(score.confidence).toBe('high');
  });

  it('a reserved (occupied) device scores lower than an available one', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    const availableScore = authority.getSuitability(gpu.deviceId, 'gpu-mining').score;
    authority.reserve(gpu.deviceId, 'allocated to another workload', 'Mining Authority');
    const reservedScore = authority.getSuitability(gpu.deviceId, 'gpu-mining').score;

    expect(reservedScore).toBeLessThan(availableScore);
  });

  it('recording a fault drops score to 0 for availability but reliability degrades independently', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    authority.recordFault(gpu.deviceId, 'driver crash', 'Hardware Authority');
    const twin = authority.getDigitalTwin(gpu.deviceId);

    expect(twin.operationalState).toBe('faulted');
    expect(twin.reliability.errorCount).toBe(1);
    expect(twin.reliability.stabilityScore).toBe(0); // 0 recoveries / 1 error
  });

  it('recovery improves stability score proportionally to recoveries vs errors', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    authority.recordFault(gpu.deviceId, 'driver crash', 'Hardware Authority');
    authority.recordRecovery(gpu.deviceId, 'driver reinstalled', 'Hardware Authority');

    const twin = authority.getDigitalTwin(gpu.deviceId);
    expect(twin.reliability.stabilityScore).toBe(1); // 1 recovery / 1 error
    expect(twin.operationalState).toBe('maintenance');
  });

  it('rankForWorkload sorts devices by suitability score descending', async () => {
    const raw = makeRawSnapshot({
      gpu: [
        { vendor: 'NVIDIA', model: 'RTX 4080', vramMB: 16384, temperatureCelsius: 60, powerLimitWatts: 320, fanSupport: true },
        { vendor: 'NVIDIA', model: 'RTX 3060', vramMB: 12288, temperatureCelsius: 60, powerLimitWatts: 170, fanSupport: true },
      ],
    });
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider(raw) });
    await authority.discover();
    const [second] = authority.getCategory('gpu').slice(1);
    authority.reserve(second.deviceId, 'busy elsewhere', 'Mining Authority'); // make it score lower

    const ranking = authority.rankForWorkload('gpu-mining');
    expect(ranking.length).toBe(2);
    expect(ranking[0].score).toBeGreaterThanOrEqual(ranking[1].score);
  });

  it('digital twin exposes identity, health, performance, operational state, reliability, and efficiency together', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    const twin = authority.getDigitalTwin(gpu.deviceId);
    expect(twin).toMatchObject({
      deviceId: gpu.deviceId,
      operationalState: 'available',
    });
    expect(twin.identity).toBeDefined();
    expect(twin.health).toBeDefined();
    expect(twin.performanceProfile).toBeDefined();
    expect(twin.reliability).toBeDefined();
    expect(twin.efficiency).toBeDefined();
    expect(Array.isArray(twin.suitabilityScores)).toBe(true);
  });
});
