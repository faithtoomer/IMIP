import type { ElectricityPricing } from './types.js';

export interface ElectricityPricingProvider {
  getPricing(): ElectricityPricing;
}

/**
 * Static pricing provider — the default integration surface for Configuration
 * Authority electricity rate data.
 */
export class StaticElectricityPricingProvider implements ElectricityPricingProvider {
  constructor(private readonly pricing: ElectricityPricing) {}

  getPricing(): ElectricityPricing {
    return { ...this.pricing };
  }
}

const DEFAULT_PEAK_HOURS = new Set([17, 18, 19, 20, 21]);

/**
 * Resolve the effective $/kWh rate at a given time. For flat billing, returns
 * ratePerKwh. For time-of-use, uses peakRate/offPeakRate when provided, falling
 * back to ratePerKwh.
 */
export function resolveEffectiveRate(pricing: ElectricityPricing, at: Date = new Date()): number {
  if (pricing.billingModel === 'flat') {
    return pricing.ratePerKwh;
  }

  const hour = at.getHours();
  const isPeak = pricing.isPeak ?? DEFAULT_PEAK_HOURS.has(hour);
  if (isPeak) {
    return pricing.peakRate ?? pricing.ratePerKwh;
  }
  return pricing.offPeakRate ?? pricing.ratePerKwh;
}

export function resolvePricingWindow(pricing: ElectricityPricing, at: Date = new Date()): 'peak' | 'off-peak' | 'flat' {
  if (pricing.billingModel === 'flat') return 'flat';
  const hour = at.getHours();
  const isPeak = pricing.isPeak ?? DEFAULT_PEAK_HOURS.has(hour);
  return isPeak ? 'peak' : 'off-peak';
}
