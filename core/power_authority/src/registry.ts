import { PowerNotFoundError } from './errors.js';
import type { PowerDomain, PowerProfile } from './types.js';

/**
 * §6 — Power Registry. Sole authoritative store of device power profiles,
 * keyed by deviceId.
 */
export class PowerRegistry {
  private profiles = new Map<string, PowerProfile>();

  upsert(profile: PowerProfile): void {
    this.profiles.set(profile.deviceId, profile);
  }

  remove(deviceId: string): boolean {
    return this.profiles.delete(deviceId);
  }

  get(deviceId: string): PowerProfile | undefined {
    return this.profiles.get(deviceId);
  }

  require(deviceId: string): PowerProfile {
    const profile = this.profiles.get(deviceId);
    if (!profile) throw new PowerNotFoundError('Device power profile', deviceId);
    return profile;
  }

  all(): PowerProfile[] {
    return [...this.profiles.values()];
  }

  ids(): string[] {
    return [...this.profiles.keys()];
  }

  byDomain(domain: PowerDomain): PowerProfile[] {
    return this.all().filter((profile) => profile.deviceType === domain);
  }

  totalCurrentWatts(): number {
    return this.all().reduce((sum, profile) => sum + profile.currentWatts, 0);
  }
}
