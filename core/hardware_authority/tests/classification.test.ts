import { describe, expect, it } from 'vitest';
import { classifyDevices } from '../src/classification.js';
import { makeRawSnapshot } from './testHelpers.js';

describe('classifyDevices (§6)', () => {
  it('classifies one device per category present in the raw snapshot', () => {
    const devices = classifyDevices(makeRawSnapshot());
    const categories = devices.map((d) => d.category);
    expect(categories).toEqual(expect.arrayContaining(['cpu', 'gpu', 'memory', 'storage', 'motherboard', 'network']));
    expect(categories).not.toContain('asic'); // none present in the default fixture
  });

  it('maps CPU fields per §6', () => {
    const [cpu] = classifyDevices(makeRawSnapshot()).filter((d) => d.category === 'cpu');
    const info = cpu.categoryInfo as { physicalCores?: number; logicalCores?: number; instructionSets?: string[]; socket?: string };
    expect(info.physicalCores).toBe(16);
    expect(info.logicalCores).toBe(32);
    expect(info.instructionSets).toEqual(['aes', 'avx2', 'sse4_2']);
    expect(info.socket).toBe('AM5');
  });

  it('maps GPU fields per §6', () => {
    const [gpu] = classifyDevices(makeRawSnapshot()).filter((d) => d.category === 'gpu');
    const info = gpu.categoryInfo as { vramMB?: number; cudaSupport?: boolean };
    expect(info.vramMB).toBe(16384);
    expect(info.cudaSupport).toBe(true); // vendor contains "NVIDIA"
  });

  it('supports multiple GPUs', () => {
    const raw = makeRawSnapshot({
      gpu: [
        { vendor: 'NVIDIA', model: 'RTX 4080', vramMB: 16384 },
        { vendor: 'AMD', model: 'RX 7900 XTX', vramMB: 24576 },
      ],
    });
    const gpus = classifyDevices(raw).filter((d) => d.category === 'gpu');
    expect(gpus).toHaveLength(2);
    expect(new Set(gpus.map((g) => g.deviceId)).size).toBe(2); // distinct ids
  });

  it('architecture supports ASIC even when none are present', () => {
    const devices = classifyDevices(makeRawSnapshot({ asic: [] }));
    expect(devices.filter((d) => d.category === 'asic')).toEqual([]);
  });

  it('classifies an ASIC device when present', () => {
    const raw = makeRawSnapshot({
      asic: [{ vendor: 'Bitmain', model: 'Antminer S19', firmware: '1.0', hashBoards: 3, poolConnectivity: 'connected' }],
    });
    const [asic] = classifyDevices(raw).filter((d) => d.category === 'asic');
    expect(asic).toBeDefined();
    expect((asic.categoryInfo as { hashBoards?: number }).hashBoards).toBe(3);
  });

  it('produces a stable device id across repeated classification of identical input', () => {
    const raw = makeRawSnapshot();
    const first = classifyDevices(raw).find((d) => d.category === 'gpu')!.deviceId;
    const second = classifyDevices(raw).find((d) => d.category === 'gpu')!.deviceId;
    expect(first).toBe(second);
  });

  it('falls back to a positional id when no identifying data is available', () => {
    const raw = makeRawSnapshot({ motherboard: { manufacturer: undefined, model: undefined, biosVersion: undefined, chipset: undefined } });
    const [motherboard] = classifyDevices(raw).filter((d) => d.category === 'motherboard');
    expect(motherboard.deviceId).toBe('motherboard-0');
  });

  it('starts every device unassessed: unknown health, discovered lifecycle stage, offline runtime state', () => {
    const [cpu] = classifyDevices(makeRawSnapshot()).filter((d) => d.category === 'cpu');
    expect(cpu.health.status).toBe('unknown');
    expect(cpu.lifecycleStage).toBe('discovered');
    expect(cpu.runtimeState).toBe('offline');
  });
});
