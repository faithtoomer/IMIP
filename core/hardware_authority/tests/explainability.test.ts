import { describe, expect, it } from 'vitest';
import { HardwareAuthority } from '../src/HardwareAuthority.js';
import { FakeDiscoveryProvider } from './testHelpers.js';

describe('Hardware audit trail (§13 explainability)', () => {
  it('records a discovery entry for every newly discovered device', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    const records = authority.audit.forDevice(gpu.deviceId);
    expect(records.some((r) => r.kind === 'discovered')).toBe(true);
    expect(records.some((r) => r.kind === 'lifecycle-transition')).toBe(true);
    expect(records.some((r) => r.kind === 'state-transition')).toBe(true);
  });

  it('records are immutable once written', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    const [record] = authority.audit.forDevice(gpu.deviceId);
    expect(Object.isFrozen(record)).toBe(true);
  });

  it('every audit record can answer which authority initiated it', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    authority.reserve(gpu.deviceId, 'allocated for mining', 'Mining Authority');
    const [transition] = authority.audit.forDevice(gpu.deviceId).filter((r) => r.kind === 'state-transition' && r.details.to === 'reserved');
    expect(transition.initiatingAuthority).toBe('Mining Authority');
    expect(transition.reason).toBe('allocated for mining');
  });

  it('a device answers what/capabilities/health/state via getDigitalTwin, and why-available via audit', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await authority.discover();
    const gpu = authority.getCategory('gpu')[0];

    const twin = authority.getDigitalTwin(gpu.deviceId);
    expect(twin.identity.vendor).toBeTruthy();
    expect(twin.capabilities.length).toBeGreaterThan(0);
    expect(twin.health.status).toBeTruthy();
    expect(twin.operationalState).toBe('available');

    const discoveredRecord = authority.audit.forDevice(gpu.deviceId).find((r) => r.kind === 'discovered');
    expect(discoveredRecord).toBeDefined();
  });
});
