import type { ConfigurationAuthority } from '../../configuration_authority/src/index.js';
import { NoPricingConfigurationError } from './errors.js';
import type { EnergyCostSnapshot, PricingModel } from './types.js';

export interface TimeOfUseWindow {
  startHour: number;
  endHour: number;
  period: 'peak' | 'off-peak';
}

function parseTimeOfUseSchedule(raw: unknown): TimeOfUseWindow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is TimeOfUseWindow => {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as TimeOfUseWindow).startHour === 'number' &&
      typeof (entry as TimeOfUseWindow).endHour === 'number' &&
      ((entry as TimeOfUseWindow).period === 'peak' || (entry as TimeOfUseWindow).period === 'off-peak')
    );
  });
}

function hourInWindow(hour: number, startHour: number, endHour: number): boolean {
  return startHour <= endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
}

/**
 * §9 — Energy Cost Analysis. Reads ICMS's real, already-existing
 * `electricity.*` config values (Phase 02) — IPIA is the first real
 * consumer; no fabricated pricing data. See ADR-0019.
 */
export class CostEngine {
  constructor(private readonly configurationAuthority: ConfigurationAuthority) {}

  /** The real rate applicable at a given moment, resolved from ICMS's real
   * config. Honestly falls back to the flat rate when `billingModel` is
   * `'time-of-use'` but no configured window matches — never fabricates a
   * peak/off-peak guess without a real schedule entry to justify it. */
  effectiveRate(at: Date): { ratePerKwh: number; pricingModel: PricingModel; period: 'peak' | 'off-peak' | 'flat' } {
    const billingModel = this.configurationAuthority.get('electricity.billingModel');
    const flatRate = Number(this.configurationAuthority.get('electricity.rate'));

    if (billingModel !== 'time-of-use') {
      return { ratePerKwh: flatRate, pricingModel: 'flat', period: 'flat' };
    }

    const windows = parseTimeOfUseSchedule(this.configurationAuthority.get('electricity.timeOfUseSchedule'));
    const hour = at.getUTCHours();
    const matched = windows.find((w) => hourInWindow(hour, w.startHour, w.endHour));
    if (!matched) {
      return { ratePerKwh: flatRate, pricingModel: 'flat', period: 'flat' };
    }

    const peakRate = Number(this.configurationAuthority.get('electricity.peakPricing'));
    const offPeakRate = Number(this.configurationAuthority.get('electricity.offPeakPricing'));
    return { ratePerKwh: matched.period === 'peak' ? peakRate : offPeakRate, pricingModel: 'time-of-use', period: matched.period };
  }

  /** Used by the Recommendation Engine's "delay until off-peak" heuristic
   * (§12) — honestly `true` whenever no real time-of-use schedule applies,
   * since there is then no real peak window to avoid. */
  isCurrentlyOffPeak(at: Date): boolean {
    return this.effectiveRate(at).period !== 'peak';
  }

  /** Cost of drawing `watts` continuously for `hours`, at the real rate
   * applicable at `at` — covers §9's "cost per hour"/"cost per day"/"cost
   * per mining session" (hours = 1, 24, or a session's real duration). */
  computeCost(deviceId: string | undefined, watts: number, hours: number, at: Date = new Date()): EnergyCostSnapshot {
    if (!Number.isFinite(watts) || watts < 0) throw new NoPricingConfigurationError(`invalid wattage input (${watts}W)`);
    if (!Number.isFinite(hours) || hours < 0) throw new NoPricingConfigurationError(`invalid duration input (${hours}h)`);

    const { ratePerKwh, pricingModel } = this.effectiveRate(at);
    if (!Number.isFinite(ratePerKwh)) throw new NoPricingConfigurationError('electricity rate is not configured');

    const kwh = (watts / 1000) * hours;
    const currency = String(this.configurationAuthority.get('electricity.currency'));
    const periodEnd = at.toISOString();
    const periodStart = new Date(at.getTime() - hours * 3_600_000).toISOString();

    return { deviceId, periodStart, periodEnd, kwh, ratePerKwh, currency, totalCost: kwh * ratePerKwh, pricingModel };
  }
}
