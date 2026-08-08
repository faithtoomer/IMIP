import type { CostEngine } from './costEngine.js';
import type { EfficiencyEngine } from './efficiencyEngine.js';
import type { EnergyCostSnapshot, PowerProfile, PowerReading } from './types.js';

/**
 * §23 — Architect's Enhancement: the Institutional Energy Digital Twin
 * (IEDT), built in full per the same "build now" pattern confirmed
 * unanimously for every prior Architect's Enhancement (Phases 10–15).
 * Relates real data already tracked elsewhere in this module — real
 * `PowerProfile`s, real `PowerReading` history, real ICMS electricity
 * pricing (via `CostEngine`), real IHIS benchmark data (via
 * `EfficiencyEngine`) — never a separate, invented data source.
 */
export class InstitutionalEnergyDigitalTwin {
  constructor(
    private readonly profiles: () => PowerProfile[],
    private readonly historyFor: (deviceId: string, since?: string) => PowerReading[],
    private readonly costEngine: CostEngine,
    private readonly efficiencyEngine: EfficiencyEngine,
  ) {}

  /** §23 example question: "which GPU consistently provides the highest
   * revenue per kilowatt-hour?" Honestly empty when no real `RevenueSource`
   * is supplied — never a fabricated ranking. */
  bestRevenuePerKwh(): { deviceId: string; revenuePerKwh: number }[] {
    return this.profiles()
      .map((profile) => ({
        deviceId: profile.deviceId,
        revenuePerKwh: this.efficiencyEngine.compute(profile.deviceId, profile.currentPowerWatts).revenuePerKwh,
      }))
      .filter((entry): entry is { deviceId: string; revenuePerKwh: number } => entry.revenuePerKwh !== undefined)
      .sort((a, b) => b.revenuePerKwh - a.revenuePerKwh);
  }

  /** §23 example question: "how would reducing total platform power by 10%
   * affect profitability?" Wattage/cost impact is always real; profitability
   * impact is only stated when real revenue data exists (Law 3) — otherwise
   * honestly reported as unknown rather than guessed. */
  projectPowerReduction(reductionPercent: number, at: Date = new Date()): {
    currentTotalWatts: number;
    projectedTotalWatts: number;
    estimatedCostSavingsPerHour?: number;
    profitabilityImpact: string;
  } {
    const currentTotalWatts = this.profiles().reduce((sum, profile) => sum + (profile.currentPowerWatts ?? 0), 0);
    const projectedTotalWatts = currentTotalWatts * (1 - reductionPercent / 100);
    const savingsWatts = currentTotalWatts - projectedTotalWatts;

    let estimatedCostSavingsPerHour: number | undefined;
    try {
      estimatedCostSavingsPerHour = this.costEngine.computeCost(undefined, savingsWatts, 1, at).totalCost;
    } catch {
      estimatedCostSavingsPerHour = undefined;
    }

    const hasRevenueData = this.bestRevenuePerKwh().length > 0;
    return {
      currentTotalWatts,
      projectedTotalWatts,
      estimatedCostSavingsPerHour,
      profitabilityImpact: hasRevenueData
        ? 'Estimable from recorded revenuePerKwh data — see bestRevenuePerKwh().'
        : 'Unknown — no real revenue data source is currently supplied (Law 3: measurement before optimization).',
    };
  }

  /** §23 example question: "what is the expected electrical cost of running
   * overnight during off-peak pricing?" Real computation over the real
   * current platform wattage and ICMS's real electricity pricing. */
  offPeakCostEstimate(hours: number, at: Date = new Date()): EnergyCostSnapshot {
    const totalWatts = this.profiles().reduce((sum, profile) => sum + (profile.currentPowerWatts ?? 0), 0);
    return this.costEngine.computeCost(undefined, totalWatts, hours, at);
  }

  /** §23 example question: "which hardware contributes most to total energy
   * consumption?" Ranked by real measured average draw. */
  topEnergyConsumers(limit = 5): { deviceId: string; averagePowerWatts: number }[] {
    return this.profiles()
      .filter((profile): profile is PowerProfile & { averagePowerWatts: number } => profile.averagePowerWatts !== undefined)
      .map((profile) => ({ deviceId: profile.deviceId, averagePowerWatts: profile.averagePowerWatts }))
      .sort((a, b) => b.averagePowerWatts - a.averagePowerWatts)
      .slice(0, limit);
  }

  /** §23 example question: "how has energy efficiency changed over the last
   * 30 days?" Real wattage history throughout; `hashesPerWatt` at each point
   * uses the *current* best benchmark value against that historical reading
   * — this platform does not track a historical benchmark time series, so
   * this is a documented, honest approximation, not a fabricated one. */
  efficiencyTrend(deviceId: string, since?: string): { recordedAt: string; watts: number; hashesPerWatt?: number }[] {
    return this.historyFor(deviceId, since).map((reading) => ({
      recordedAt: reading.recordedAt,
      watts: reading.watts,
      hashesPerWatt: this.efficiencyEngine.compute(deviceId, reading.watts, new Date(reading.recordedAt)).hashesPerWatt,
    }));
  }
}
