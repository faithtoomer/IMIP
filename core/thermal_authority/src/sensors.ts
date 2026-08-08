import type { ThermalSample } from './types.js';

export interface ThermalSensorOutcome {
  samples: ThermalSample[];
  unavailableDeviceIds?: string[];
}

export interface ThermalSensorProvider {
  collect(): Promise<ThermalSensorOutcome>;
}

/**
 * Injectable sensor provider for tests and integration with IHIS or other
 * sensor acquisition backends. Missing sensors are first-class via
 * `sensorAvailable: false` on individual samples.
 */
export class InjectableThermalSensorProvider implements ThermalSensorProvider {
  private samples: ThermalSample[] = [];

  setSamples(samples: ThermalSample[]): void {
    this.samples = samples;
  }

  async collect(): Promise<ThermalSensorOutcome> {
    const unavailableDeviceIds = this.samples
      .filter((sample) => !sample.sensorAvailable)
      .map((sample) => sample.deviceId);
    return {
      samples: this.samples,
      unavailableDeviceIds: unavailableDeviceIds.length > 0 ? unavailableDeviceIds : undefined,
    };
  }
}
