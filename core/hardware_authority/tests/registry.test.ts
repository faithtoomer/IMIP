import { describe, expect, it } from 'vitest';
import { HardwareRegistry } from '../src/registry.js';
import type { DeviceRecord } from '../src/types.js';

function makeDevice(overrides: Partial<DeviceRecord> = {}): DeviceRecord {
  const now = new Date().toISOString();
  return {
    deviceId: 'gpu-abc123',
    category: 'gpu',
    identity: { vendor: 'NVIDIA', model: 'RTX 4080' },
    categoryInfo: { vendor: 'NVIDIA', model: 'RTX 4080', vramMB: 16384 },
    capabilities: ['gpu-mining', 'benchmarking', 'hardware-telemetry'],
    health: { status: 'healthy', reasons: ['No adverse signals observed.'], lastCheckedAt: now },
    lifecycleStage: 'capability-assessed',
    runtimeState: 'available',
    discoveryTimestamp: now,
    lastUpdated: now,
    owningAuthority: 'Hardware Authority',
    securityClassification: 'public',
    ...overrides,
  };
}

describe('HardwareRegistry', () => {
  it('upsert() registers a new device', () => {
    const registry = new HardwareRegistry();
    registry.upsert(makeDevice());
    expect(registry.ids()).toEqual(['gpu-abc123']);
  });

  it('upsert() with the same id updates rather than duplicates', () => {
    const registry = new HardwareRegistry();
    registry.upsert(makeDevice());
    registry.upsert(makeDevice({ runtimeState: 'mining' }));
    expect(registry.all()).toHaveLength(1);
    expect(registry.get('gpu-abc123')?.runtimeState).toBe('mining');
  });

  it('require() throws for an unknown device', () => {
    const registry = new HardwareRegistry();
    expect(() => registry.require('nope')).toThrow(/Unknown device/);
  });

  it('byCategory() filters correctly', () => {
    const registry = new HardwareRegistry();
    registry.upsert(makeDevice({ deviceId: 'gpu-1', category: 'gpu' }));
    registry.upsert(makeDevice({ deviceId: 'cpu-1', category: 'cpu' }));
    expect(registry.byCategory('gpu')).toHaveLength(1);
    expect(registry.byCategory('cpu')).toHaveLength(1);
  });

  it('byCapability() filters correctly', () => {
    const registry = new HardwareRegistry();
    registry.upsert(makeDevice({ deviceId: 'gpu-1', capabilities: ['gpu-mining'] }));
    registry.upsert(makeDevice({ deviceId: 'cpu-1', capabilities: ['cpu-mining'] }));
    expect(registry.byCapability('gpu-mining').map((d) => d.deviceId)).toEqual(['gpu-1']);
  });

  it('remove() deletes a device', () => {
    const registry = new HardwareRegistry();
    registry.upsert(makeDevice());
    expect(registry.remove('gpu-abc123')).toBe(true);
    expect(registry.all()).toHaveLength(0);
  });
});
