import type { ElectricityPricing, PowerProfile, PowerSample } from '../src/types.js';
import {
  InjectablePowerTelemetryProvider,
  synthesizeSample,
  type TelemetryFailure,
} from '../src/telemetry.js';
import { StaticElectricityPricingProvider } from '../src/pricing.js';
import { PowerAuthority } from '../src/PowerAuthority.js';

export const FLAT_PRICING: ElectricityPricing = {
  ratePerKwh: 0.12,
  currency: 'USD',
  billingModel: 'flat',
};

export const TOU_PRICING: ElectricityPricing = {
  ratePerKwh: 0.12,
  currency: 'USD',
  billingModel: 'time-of-use',
  peakRate: 0.25,
  offPeakRate: 0.08,
};

export function makeProfile(overrides: Partial<PowerProfile> = {}): PowerProfile {
  const now = new Date().toISOString();
  return {
    deviceId: 'gpu-1',
    deviceType: 'gpu',
    currentWatts: 250,
    averageWatts: 240,
    peakWatts: 280,
    idleWatts: 25,
    maximumRatedWatts: 320,
    efficiencyProfile: { trend: 'stable', hashesPerWatt: 10, revenuePerKwh: 0.5 },
    costProfile: {
      ratePerKwh: 0.12,
      costPerHour: 0.0288,
      costPerDay: 0.6912,
      currency: 'USD',
      billingModel: 'flat',
      pricingWindow: 'flat',
    },
    healthStatus: 'healthy',
    lifecycleStage: 'monitored',
    lastUpdated: now,
    sensorAvailable: true,
    ...overrides,
  };
}

export function makeSample(overrides: Partial<PowerSample> = {}): PowerSample {
  return synthesizeSample('gpu-1', 250, overrides);
}

export function createTestAuthority(samples: PowerSample[] = [], failures: TelemetryFailure[] = []) {
  const telemetry = new InjectablePowerTelemetryProvider();
  telemetry.setSamples(samples);
  telemetry.setFailures(failures);
  const pricing = new StaticElectricityPricingProvider(FLAT_PRICING);
  const authority = new PowerAuthority({ telemetryProvider: telemetry, pricingProvider: pricing });
  return { authority, telemetry, pricing };
}

export function registerGpu(authority: PowerAuthority, deviceId = 'gpu-1', maxWatts = 320) {
  return authority.registerDevice({ deviceId, deviceType: 'gpu', maximumRatedWatts: maxWatts, idleWatts: 25 });
}

export function registerCpu(authority: PowerAuthority, deviceId = 'cpu-1', maxWatts = 125) {
  return authority.registerDevice({ deviceId, deviceType: 'cpu', maximumRatedWatts: maxWatts, idleWatts: 15 });
}
