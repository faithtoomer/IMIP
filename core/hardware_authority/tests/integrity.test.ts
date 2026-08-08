import { describe, expect, it } from 'vitest';
import { detectDuplicateDeviceIds, detectInventoryInconsistencies } from '../src/integrity.js';
import { HardwareAuthority } from '../src/HardwareAuthority.js';
import { HARDWARE_EVENTS } from '../src/events.js';
import { FakeDiscoveryProvider } from './testHelpers.js';
import type { DeviceRecord } from '../src/types.js';

function makeDevice(overrides: Partial<DeviceRecord> = {}): DeviceRecord {
  const now = new Date().toISOString();
  return {
    deviceId: 'gpu-1',
    category: 'gpu',
    identity: {},
    categoryInfo: {},
    capabilities: ['gpu-mining'],
    health: { status: 'healthy', reasons: [], lastCheckedAt: now },
    lifecycleStage: 'available',
    runtimeState: 'available',
    discoveryTimestamp: now,
    lastUpdated: now,
    owningAuthority: 'Hardware Authority',
    securityClassification: 'public',
    ...overrides,
  };
}

describe('detectDuplicateDeviceIds (§15)', () => {
  it('finds no duplicates when every deviceId is unique', () => {
    const devices = [makeDevice({ deviceId: 'a' }), makeDevice({ deviceId: 'b' })];
    expect(detectDuplicateDeviceIds(devices)).toEqual([]);
  });

  it('reports a collision when two devices share a deviceId', () => {
    const devices = [makeDevice({ deviceId: 'a' }), makeDevice({ deviceId: 'a' })];
    const issues = detectDuplicateDeviceIds(devices);
    expect(issues).toEqual([{ deviceId: 'a', issue: expect.stringContaining('2 discovered devices collided') }]);
  });
});

describe('detectInventoryInconsistencies (§15)', () => {
  it('finds no issues in a clean inventory', () => {
    expect(detectInventoryInconsistencies([makeDevice()])).toEqual([]);
  });

  it('flags a retired device that is not offline', () => {
    const issues = detectInventoryInconsistencies([makeDevice({ lifecycleStage: 'retired', runtimeState: 'available' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toMatch(/retired but runtime state/);
  });

  it('flags an actively-working device whose lifecycle stage is not yet capability-assessed', () => {
    const issues = detectInventoryInconsistencies([makeDevice({ lifecycleStage: 'discovered', runtimeState: 'mining' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toMatch(/not yet capability-assessed/);
  });

  it('flags an allocation record on a device that is not lifecycle-allocated', () => {
    const issues = detectInventoryInconsistencies([
      makeDevice({
        lifecycleStage: 'available',
        allocation: { ownerId: 'x', ownerAuthority: 'y', allocatedAt: new Date().toISOString(), reason: 'z' },
      }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toMatch(/allocation record but lifecycle stage/);
  });
});

describe('HardwareAuthority integrity integration', () => {
  it('checkIntegrity() finds no issues for a normally-discovered device', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    expect(authority.checkIntegrity()).toEqual([]);
  });

  it('discover() publishes HardwareFaultDetected and audits a duplicate-id collision without crashing', async () => {
    // Two GPUs with identical vendor+model and no serial hash to the same deviceId.
    const raw = {
      cpu: [{ manufacturer: 'AMD', brand: 'Ryzen 9', family: 'Zen4', physicalCores: 8, cores: 16 }],
      gpu: [
        { vendor: 'NVIDIA', model: 'RTX 4080', vramMB: 16384 },
        { vendor: 'NVIDIA', model: 'RTX 4080', vramMB: 16384 },
      ],
      asic: [],
      memory: { totalMB: 32768, freeMB: 16384 },
      storage: [],
      motherboard: null,
      network: [],
      discoveredAt: new Date().toISOString(),
    };
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider(raw) });

    const faults: unknown[] = [];
    authority.subscribe(HARDWARE_EVENTS.HardwareFaultDetected, (p) => faults.push(p));

    const snapshot = await authority.discover();

    expect(snapshot).toBeDefined();
    expect(faults.some((f) => (f as { reason: string }).reason.includes('collided'))).toBe(true);
    // The collision is diagnosed, not silently swallowed — the audit trail carries it too.
    expect(authority.audit.all().some((r) => r.reason === 'duplicate-device-id')).toBe(true);
  });
});
