import type { DeviceRecord, HardwareCapability, HardwareCategory } from './types.js';

/**
 * §1 Law 1 / §8 — Hardware Registry. Sole authoritative store of discovered devices,
 * keyed by deviceId. Re-registering an existing id replaces (updates) that entry;
 * it never creates a duplicate — that is what distinguishes "update" from
 * "duplicate ownership."
 */
export class HardwareRegistry {
  private devices = new Map<string, DeviceRecord>();

  upsert(device: DeviceRecord): void {
    this.devices.set(device.deviceId, device);
  }

  remove(deviceId: string): boolean {
    return this.devices.delete(deviceId);
  }

  get(deviceId: string): DeviceRecord | undefined {
    return this.devices.get(deviceId);
  }

  require(deviceId: string): DeviceRecord {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error(`Unknown device: "${deviceId}"`);
    return device;
  }

  all(): DeviceRecord[] {
    return [...this.devices.values()];
  }

  ids(): string[] {
    return [...this.devices.keys()];
  }

  byCategory(category: HardwareCategory): DeviceRecord[] {
    return this.all().filter((device) => device.category === category);
  }

  byCapability(capability: HardwareCapability): DeviceRecord[] {
    return this.all().filter((device) => device.capabilities.includes(capability));
  }
}
