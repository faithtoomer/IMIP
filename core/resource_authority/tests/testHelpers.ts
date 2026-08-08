import type { HardwareInventoryUnit } from '../src/providers.js';
import type { ResourceProfile } from '../src/types.js';
import {
  MapHardwareInventoryProvider,
  MapPowerConstraintProvider,
  MapThermalConstraintProvider,
} from '../src/providers.js';
import { ResourceAuthority } from '../src/ResourceAuthority.js';

export const FIXED_NOW = '2026-08-08T12:00:00.000Z';
export const FIXED_LATER = '2026-08-08T13:00:00.000Z';
export const FIXED_EXPIRED = '2026-08-08T11:00:00.000Z';

export function makeInventoryUnit(overrides: Partial<HardwareInventoryUnit> = {}): HardwareInventoryUnit {
  return {
    hardwareId: 'hw-gpu-001',
    resourceType: 'gpu',
    maximumCapacity: 100,
    capabilityRefs: ['gpu-mining', 'ai-inference'],
    healthStatus: 'healthy',
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<ResourceProfile> = {}): ResourceProfile {
  return {
    resourceId: 'hw-gpu-001:gpu',
    resourceType: 'gpu',
    hardwareId: 'hw-gpu-001',
    state: 'available',
    availableCapacity: 100,
    reservedCapacity: 0,
    utilizedCapacity: 0,
    maximumCapacity: 100,
    capabilityRefs: ['gpu-mining'],
    healthStatus: 'healthy',
    lastUpdated: FIXED_NOW,
    ...overrides,
  };
}

export function makeAuthority(
  units: HardwareInventoryUnit[] = [makeInventoryUnit()],
  options: {
    powerBlocking?: Map<string, boolean>;
    thermalBlocking?: Map<string, boolean>;
    now?: () => string;
  } = {},
): ResourceAuthority {
  return new ResourceAuthority({
    hardwareInventoryProvider: new MapHardwareInventoryProvider(units),
    powerConstraintProvider: new MapPowerConstraintProvider(options.powerBlocking),
    thermalConstraintProvider: new MapThermalConstraintProvider(options.thermalBlocking),
    now: options.now ?? (() => FIXED_NOW),
  });
}

export async function syncDefault(authority: ResourceAuthority): Promise<void> {
  await authority.syncFromHardwareInventory();
}
