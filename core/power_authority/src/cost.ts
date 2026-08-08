import { PowerCostError } from './errors.js';
import type { CostProfile, ElectricityPricing } from './types.js';
import { resolveEffectiveRate, resolvePricingWindow } from './pricing.js';

const HOURS_PER_DAY = 24;

/** Convert watt-hours to kilowatt-hours. */
export function wattHoursToKwh(wattHours: number): number {
  return wattHours / 1000;
}

/** Convert instantaneous watts over a duration in hours to kWh. */
export function wattsToKwh(watts: number, hours: number): number {
  return wattHoursToKwh(watts * hours);
}

/** Compute cost from kWh and rate. */
export function costFromKwh(kwh: number, ratePerKwh: number): number {
  if (!Number.isFinite(kwh) || !Number.isFinite(ratePerKwh)) {
    throw new PowerCostError('Cost calculation requires finite kWh and rate values.');
  }
  if (kwh < 0 || ratePerKwh < 0) {
    throw new PowerCostError('Cost calculation requires non-negative kWh and rate values.');
  }
  return kwh * ratePerKwh;
}

/** Compute session cost from average watts and session duration in hours. */
export function sessionCostFromWatts(averageWatts: number, sessionHours: number, pricing: ElectricityPricing, at?: Date): number {
  const rate = resolveEffectiveRate(pricing, at);
  const kwh = wattsToKwh(averageWatts, sessionHours);
  return costFromKwh(kwh, rate);
}

/**
 * Compute a CostProfile from average power draw and electricity pricing.
 */
export function computeCostProfile(averageWatts: number, pricing: ElectricityPricing, at?: Date): CostProfile {
  if (!Number.isFinite(averageWatts) || averageWatts < 0) {
    throw new PowerCostError('Average watts must be a non-negative finite number.');
  }

  const rate = resolveEffectiveRate(pricing, at);
  const pricingWindow = resolvePricingWindow(pricing, at);
  const costPerHour = costFromKwh(wattsToKwh(averageWatts, 1), rate);
  const costPerDay = costPerHour * HOURS_PER_DAY;

  return {
    ratePerKwh: rate,
    costPerHour,
    costPerDay,
    currency: pricing.currency,
    billingModel: pricing.billingModel,
    pricingWindow,
  };
}
