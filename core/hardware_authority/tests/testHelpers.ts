import type { DiscoveryFailure, DiscoveryOutcome, DiscoveryProvider } from '../src/discovery.js';
import type { RawDiscoverySnapshot } from '../src/types.js';

/** Synthetic, deterministic hardware data — never a real `systeminformation` call.
 * Every test either uses this directly or overrides specific fields. */
export function makeRawSnapshot(overrides: Partial<RawDiscoverySnapshot> = {}): RawDiscoverySnapshot {
  return {
    cpu: [
      {
        manufacturer: 'AMD',
        brand: 'Ryzen 9 7950X',
        family: 'Zen4',
        physicalCores: 16,
        cores: 32,
        cacheL1KB: 32,
        cacheL2KB: 1024,
        cacheL3KB: 65536,
        flags: ['aes', 'avx2', 'sse4_2'],
        virtualization: true,
        currentLoadPercent: 12.5,
        speedMHz: 4500,
        speedMinMHz: 2200,
        speedMaxMHz: 5700,
        temperatureCelsius: 55,
      },
    ],
    gpu: [
      {
        vendor: 'NVIDIA',
        model: 'RTX 4080',
        vramMB: 16384,
        driverVersion: '551.23',
        bus: 'PCIe',
        temperatureCelsius: 62,
        powerLimitWatts: 320,
        fanSupport: true,
      },
    ],
    asic: [],
    memory: { totalMB: 65536, freeMB: 40000, ecc: false },
    storage: [{ type: 'NVMe', sizeMB: 2_000_000, availableMB: 1_200_000, smartStatus: 'Ok' }],
    motherboard: { manufacturer: 'ASUS', model: 'ROG X670E', biosVersion: '1203', chipset: 'X670E' },
    network: [{ name: 'Ethernet', speedMbps: 1000, operstate: 'up' }],
    discoveredAt: new Date().toISOString(),
    ...overrides,
  };
}

export class FakeDiscoveryProvider implements DiscoveryProvider {
  constructor(
    private snapshot: RawDiscoverySnapshot = makeRawSnapshot(),
    private failures: DiscoveryFailure[] = [],
  ) {}

  setSnapshot(snapshot: RawDiscoverySnapshot): void {
    this.snapshot = snapshot;
  }

  setFailures(failures: DiscoveryFailure[]): void {
    this.failures = failures;
  }

  async discover(): Promise<DiscoveryOutcome> {
    return { snapshot: this.snapshot, failures: this.failures };
  }
}
