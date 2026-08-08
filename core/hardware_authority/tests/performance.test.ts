import { describe, expect, it } from 'vitest';
import { HardwareAuthority } from '../src/HardwareAuthority.js';
import { FakeDiscoveryProvider, makeRawSnapshot } from './testHelpers.js';

/** §16/§19 — lightweight performance smoke test, not a benchmarking suite. */
describe('performance smoke tests', () => {
  it('discover() completes well under 200ms against a fake provider', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    const start = performance.now();
    await authority.discover();
    expect(performance.now() - start).toBeLessThan(200);
  });

  it('rankForWorkload scales reasonably across many devices', async () => {
    const gpus = Array.from({ length: 50 }, (_, i) => ({
      vendor: 'NVIDIA',
      model: `RTX-${i}`,
      vramMB: 8192,
      temperatureCelsius: 60,
      powerLimitWatts: 250,
      fanSupport: true,
    }));
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider(makeRawSnapshot({ gpu: gpus })) });
    await authority.discover();

    const start = performance.now();
    const ranking = authority.rankForWorkload('gpu-mining');
    expect(performance.now() - start).toBeLessThan(200);
    expect(ranking).toHaveLength(50);
  });
});
