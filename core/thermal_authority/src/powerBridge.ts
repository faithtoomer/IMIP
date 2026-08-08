/** Cross-domain power snapshot provider — no direct IPIA import. */

export interface PowerSnapshotProvider {
  getPowerWatts(deviceId: string): number | undefined;
}

export class NullPowerSnapshotProvider implements PowerSnapshotProvider {
  getPowerWatts(): number | undefined {
    return undefined;
  }
}

export class MapPowerSnapshotProvider implements PowerSnapshotProvider {
  constructor(private readonly wattsByDevice: Map<string, number> | Record<string, number>) {}

  getPowerWatts(deviceId: string): number | undefined {
    if (this.wattsByDevice instanceof Map) {
      return this.wattsByDevice.get(deviceId);
    }
    return this.wattsByDevice[deviceId];
  }
}
