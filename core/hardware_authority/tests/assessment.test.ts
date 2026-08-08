import { describe, expect, it } from 'vitest';
import { classifyDevices } from '../src/classification.js';
import { assessCapabilities, assessHealth } from '../src/assessment.js';
import { makeRawSnapshot } from './testHelpers.js';

function classified(overrides: Parameters<typeof makeRawSnapshot>[0] = {}) {
  return classifyDevices(makeRawSnapshot(overrides));
}

describe('assessCapabilities (§7, Law 2 — capability before identity)', () => {
  it('CPU gets cpu-mining, benchmarking, hardware-telemetry, and virtualization when supported', () => {
    const [cpu] = classified().filter((d) => d.category === 'cpu');
    const caps = assessCapabilities(cpu);
    expect(caps).toEqual(expect.arrayContaining(['cpu-mining', 'benchmarking', 'hardware-telemetry', 'virtualization']));
  });

  it('GPU with enough VRAM and CUDA gets gpu-mining, ai-inference, and ai-training', () => {
    const [gpu] = classified().filter((d) => d.category === 'gpu');
    const caps = assessCapabilities(gpu);
    expect(caps).toEqual(
      expect.arrayContaining(['gpu-mining', 'ai-inference', 'ai-training', 'thermal-monitoring', 'power-monitoring', 'fan-control']),
    );
  });

  it('GPU capability assessment never branches on the model string (Law 2)', () => {
    const raw = makeRawSnapshot({ gpu: [{ vendor: 'NVIDIA', model: 'Totally Fictional Model XYZ', vramMB: 16384, temperatureCelsius: 60, powerLimitWatts: 300, fanSupport: true }] });
    const [gpu] = classifyDevices(raw).filter((d) => d.category === 'gpu');
    expect(assessCapabilities(gpu)).toContain('gpu-mining');
  });

  it('a low-VRAM non-CUDA GPU is not assessed as AI-capable', () => {
    const raw = makeRawSnapshot({ gpu: [{ vendor: 'Intel', model: 'Iris Xe', vramMB: 1024 }] });
    const [gpu] = classifyDevices(raw).filter((d) => d.category === 'gpu');
    const caps = assessCapabilities(gpu);
    expect(caps).not.toContain('ai-inference');
    expect(caps).toContain('gpu-mining'); // still has VRAM reported, so still mining-capable
  });

  it('ASIC always gets asic-mining and hardware-telemetry', () => {
    const raw = makeRawSnapshot({ asic: [{ vendor: 'Bitmain', model: 'S19', poolConnectivity: 'unknown' }] });
    const [asic] = classifyDevices(raw).filter((d) => d.category === 'asic');
    expect(assessCapabilities(asic)).toEqual(['asic-mining', 'hardware-telemetry']);
  });

  it('memory/storage/motherboard/network are telemetry-only, never mining/AI capable', () => {
    for (const category of ['memory', 'storage', 'motherboard', 'network'] as const) {
      const [device] = classified().filter((d) => d.category === category);
      expect(assessCapabilities(device)).toEqual(['hardware-telemetry']);
    }
  });
});

describe('assessHealth (informational only, never a policy gate)', () => {
  it('reports healthy with no adverse signals', () => {
    const [gpu] = classified().filter((d) => d.category === 'gpu');
    const health = assessHealth(gpu, new Date().toISOString());
    expect(health.status).toBe('healthy');
  });

  it('reports degraded at the GPU degraded diagnostic threshold', () => {
    const raw = makeRawSnapshot({ gpu: [{ vendor: 'NVIDIA', model: 'RTX 4080', vramMB: 16384, temperatureCelsius: 92 }] });
    const [gpu] = classifyDevices(raw).filter((d) => d.category === 'gpu');
    expect(assessHealth(gpu, new Date().toISOString()).status).toBe('degraded');
  });

  it('reports faulted at the GPU faulted diagnostic threshold', () => {
    const raw = makeRawSnapshot({ gpu: [{ vendor: 'NVIDIA', model: 'RTX 4080', vramMB: 16384, temperatureCelsius: 101 }] });
    const [gpu] = classifyDevices(raw).filter((d) => d.category === 'gpu');
    expect(assessHealth(gpu, new Date().toISOString()).status).toBe('faulted');
  });

  it('reports unknown when no temperature sensor is available', () => {
    const raw = makeRawSnapshot({ gpu: [{ vendor: 'NVIDIA', model: 'RTX 4080', vramMB: 16384 }] });
    const [gpu] = classifyDevices(raw).filter((d) => d.category === 'gpu');
    expect(assessHealth(gpu, new Date().toISOString()).status).toBe('unknown');
  });

  it('storage health reflects a failing SMART status as faulted', () => {
    const raw = makeRawSnapshot({ storage: [{ type: 'ssd', sizeMB: 1000, availableMB: 500, smartStatus: 'Predicted Failure' }] });
    const [storage] = classifyDevices(raw).filter((d) => d.category === 'storage');
    expect(assessHealth(storage, new Date().toISOString()).status).toBe('faulted');
  });

  it('storage health reports healthy for an OK SMART status', () => {
    const raw = makeRawSnapshot({ storage: [{ type: 'ssd', sizeMB: 1000, availableMB: 500, smartStatus: 'Ok' }] });
    const [storage] = classifyDevices(raw).filter((d) => d.category === 'storage');
    expect(assessHealth(storage, new Date().toISOString()).status).toBe('healthy');
  });

  it('every health summary includes at least one explanatory reason', () => {
    const [cpu] = classified().filter((d) => d.category === 'cpu');
    const health = assessHealth(cpu, new Date().toISOString());
    expect(health.reasons.length).toBeGreaterThan(0);
  });
});
