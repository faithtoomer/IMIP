import { DeviceNotTrackedError } from './errors.js';
import type { PowerProfile } from './types.js';

/** §6 — the authoritative Power Registry: one Power Profile per monitored device. */
export class PowerRegistry {
  private profiles = new Map<string, PowerProfile>();

  register(profile: PowerProfile): void {
    this.profiles.set(profile.deviceId, profile);
  }

  update(profile: PowerProfile): PowerProfile {
    this.require(profile.deviceId);
    this.profiles.set(profile.deviceId, profile);
    return profile;
  }

  get(deviceId: string): PowerProfile | undefined {
    return this.profiles.get(deviceId);
  }

  require(deviceId: string): PowerProfile {
    const profile = this.profiles.get(deviceId);
    if (!profile) throw new DeviceNotTrackedError(deviceId);
    return profile;
  }

  has(deviceId: string): boolean {
    return this.profiles.has(deviceId);
  }

  all(): PowerProfile[] {
    return [...this.profiles.values()];
  }
}
