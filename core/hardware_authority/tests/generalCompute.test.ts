import { describe, expect, it } from 'vitest';
import { HardwareAuthority } from '../src/HardwareAuthority.js';
import { classifyDevices } from '../src/classification.js';
import { assessCapabilities } from '../src/assessment.js';
import { FakeDiscoveryProvider, makeRawSnapshot } from './testHelpers.js';

describe('general-compute capability (Architect\'s Enhancement — WSE)', () => {
  it('every CPU is assessed as general-compute capable', () => {
    const [cpu] = classifyDevices(makeRawSnapshot()).filter((d) => d.category === 'cpu');
    expect(assessCapabilities(cpu)).toContain('general-compute');
  });

  it('every recognized GPU is assessed as general-compute capable, independent of mining/AI eligibility', () => {
    const raw = makeRawSnapshot({ gpu: [{ vendor: 'Intel', model: 'Iris Xe', vramMB: 128 }] }); // too small for AI, but still general-compute
    const [gpu] = classifyDevices(raw).filter((d) => d.category === 'gpu');
    const caps = assessCapabilities(gpu);
    expect(caps).toContain('general-compute');
    expect(caps).not.toContain('ai-inference');
  });

  it('memory/storage/motherboard/network are never general-compute capable', () => {
    for (const category of ['memory', 'storage', 'motherboard', 'network'] as const) {
      const [device] = classifyDevices(makeRawSnapshot()).filter((d) => d.category === category);
      expect(assessCapabilities(device)).not.toContain('general-compute');
    }
  });

  it('rankForWorkload("general-compute") ranks CPU and GPU together', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();

    const ranking = authority.rankForWorkload('general-compute');
    const categories = new Set(ranking.map((s) => authority.getDevice(s.deviceId).category));
    expect(categories.has('cpu')).toBe(true);
    expect(categories.has('gpu')).toBe(true);
  });

  it('a general-compute suitability score is real (non-zero) for a healthy, available device', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const cpu = authority.getCategory('cpu')[0];

    const score = authority.getSuitability(cpu.deviceId, 'general-compute');
    expect(score.score).toBeGreaterThan(0);
  });
});
