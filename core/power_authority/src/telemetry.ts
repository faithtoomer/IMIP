import type { PowerSample } from './types.js';

export interface TelemetryFailure {
  deviceId: string;
  message: string;
}

export interface PowerTelemetryOutcome {
  samples: PowerSample[];
  failures: TelemetryFailure[];
}

export interface PowerTelemetryProvider {
  collect(): Promise<PowerTelemetryOutcome>;
}

/**
 * Injectable telemetry provider for tests and integration. Holds samples set
 * via setSamples() — does not require real systeminformation power sensors.
 */
export class InjectablePowerTelemetryProvider implements PowerTelemetryProvider {
  private samples: PowerSample[] = [];
  private failures: TelemetryFailure[] = [];

  setSamples(samples: PowerSample[]): void {
    this.samples = samples;
  }

  setFailures(failures: TelemetryFailure[]): void {
    this.failures = failures;
  }

  async collect(): Promise<PowerTelemetryOutcome> {
    return { samples: [...this.samples], failures: [...this.failures] };
  }
}

/** Synthesize a deterministic sample for testing or seeding. */
export function synthesizeSample(
  deviceId: string,
  watts: number,
  overrides: Partial<Omit<PowerSample, 'deviceId' | 'watts'>> = {},
): PowerSample {
  return {
    deviceId,
    watts,
    timestamp: new Date().toISOString(),
    sensorAvailable: true,
    ...overrides,
  };
}
