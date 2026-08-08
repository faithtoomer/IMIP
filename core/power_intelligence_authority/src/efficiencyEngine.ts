import type { HardwareAuthority } from '../../hardware_authority/src/index.js';
import type { EfficiencyMetrics, RevenueSource } from './types.js';

/**
 * §11 — Efficiency Analysis. `hashesPerWatt` is real and measurement-based:
 * IPIA's own measured wattage divided by IHIS's real, already-certified
 * best-benchmark hash rate (`HardwareAuthority.getBenchmarks()`) — distinct
 * from and more authoritative than IHIS's own internal, rated-power-based
 * `performancePerWatt` estimate used for Digital Twin suitability scoring
 * (see ADR-0019). `revenuePerKwh`/`costPerAcceptedShare` stay honestly
 * `undefined` until a real `RevenueSource` is supplied — no revenue or
 * share data exists anywhere in this platform yet.
 */
export class EfficiencyEngine {
  constructor(
    private readonly hardwareAuthority: HardwareAuthority,
    private revenueSource?: RevenueSource,
  ) {}

  setRevenueSource(source: RevenueSource): void {
    this.revenueSource = source;
  }

  compute(deviceId: string, measuredWatts: number | undefined, at: Date = new Date()): EfficiencyMetrics {
    let hashesPerWatt: number | undefined;
    if (measuredWatts && measuredWatts > 0) {
      const summary = this.hardwareAuthority.getBenchmarks(deviceId);
      const best = Object.values(summary.bestByWorkload)[0];
      if (best) hashesPerWatt = best.value / measuredWatts;
    }

    return {
      deviceId,
      hashesPerWatt,
      revenuePerKwh: this.revenueSource?.revenuePerKwh(deviceId),
      costPerAcceptedShare: this.revenueSource?.costPerAcceptedShare(deviceId),
      computedAt: at.toISOString(),
    };
  }
}
