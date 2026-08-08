import type { ThermalDomain, ThermalProfile } from './types.js';
import { ThermalNotFoundError } from './errors.js';

/**
 * §6 — Thermal Registry. Sole authoritative store of thermal profiles,
 * keyed by deviceId. Re-registering an existing id replaces (updates) that entry.
 */
export class ThermalRegistry {
  private profiles = new Map<string, ThermalProfile>();

  upsert(profile: ThermalProfile): void {
    this.profiles.set(profile.deviceId, profile);
  }

  remove(deviceId: string): boolean {
    return this.profiles.delete(deviceId);
  }

  get(deviceId: string): ThermalProfile | undefined {
    return this.profiles.get(deviceId);
  }

  require(deviceId: string): ThermalProfile {
    const profile = this.profiles.get(deviceId);
    if (!profile) throw new ThermalNotFoundError(deviceId);
    return profile;
  }

  all(): ThermalProfile[] {
    return [...this.profiles.values()];
  }

  ids(): string[] {
    return [...this.profiles.keys()];
  }

  byDomain(domain: ThermalDomain): ThermalProfile[] {
    return this.all().filter((profile) => profile.deviceType === domain);
  }

  byState(state: ThermalProfile['thermalState']): ThermalProfile[] {
    return this.all().filter((profile) => profile.thermalState === state);
  }
}
