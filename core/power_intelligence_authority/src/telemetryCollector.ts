import type { DataAuthority } from '../../data_authority/src/index.js';
import { InvalidPowerReadingError } from './errors.js';
import type { PowerReading, PowerSensorProvider, PowerSensorReading } from './types.js';

/** A physically implausible reading is rejected rather than recorded (§17). */
const MAX_PLAUSIBLE_WATTS = 5000;

/** §7/§8 — collects real, per-device telemetry from registered
 * `PowerSensorProvider`s (Law 3, Law 1). Persists history to IDA's real
 * `'power-history'` domain when a `DataAuthority` is supplied; otherwise
 * keeps an honest, bounded in-memory buffer so `history()` still works
 * standalone. Never fabricates a reading for a device with no registered
 * provider for its category — `sample()` returns `undefined` and the
 * caller is expected to publish `PowerSensorUnavailable`. */
export class PowerTelemetryCollector {
  private readonly providers = new Map<string, PowerSensorProvider>();
  private readonly memoryHistory: PowerReading[] = [];

  constructor(
    private readonly dataAuthority?: DataAuthority,
    private readonly maxMemoryHistoryPerDevice = 500,
  ) {}

  registerProvider(provider: PowerSensorProvider): void {
    this.providers.set(provider.category, provider);
  }

  hasProvider(category: string): boolean {
    return this.providers.has(category);
  }

  async sample(deviceId: string, category: string): Promise<PowerSensorReading | undefined> {
    const provider = this.providers.get(category);
    if (!provider) return undefined;
    return provider.read(deviceId);
  }

  record(deviceId: string, watts: number, source: PowerReading['source'], recordedAt: string): PowerReading {
    if (!Number.isFinite(watts) || watts < 0 || watts > MAX_PLAUSIBLE_WATTS) {
      throw new InvalidPowerReadingError(deviceId, watts);
    }
    const reading: PowerReading = { deviceId, watts, source, recordedAt };

    if (this.dataAuthority) {
      this.dataAuthority.create('power-history', { ...reading }, 'Power Intelligence Authority');
    } else {
      this.memoryHistory.push(reading);
      const deviceReadings = this.memoryHistory.filter((r) => r.deviceId === deviceId);
      if (deviceReadings.length > this.maxMemoryHistoryPerDevice) {
        const oldest = deviceReadings[0];
        const index = this.memoryHistory.indexOf(oldest);
        if (index >= 0) this.memoryHistory.splice(index, 1);
      }
    }
    return reading;
  }

  history(deviceId: string, since?: string): PowerReading[] {
    if (this.dataAuthority) {
      const records = this.dataAuthority.find('power-history', { filters: [{ field: 'deviceId', op: 'eq', value: deviceId }] });
      const readings = records.map((r) => r.data as unknown as PowerReading);
      return since ? readings.filter((r) => r.recordedAt >= since) : readings;
    }
    const readings = this.memoryHistory.filter((r) => r.deviceId === deviceId);
    return since ? readings.filter((r) => r.recordedAt >= since) : readings;
  }
}
