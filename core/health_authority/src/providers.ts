import type {
  HardwareHealthProvider,
  HealthObservation,
  HealthProviders,
  HealthSignalProvider,
  PowerHealthProvider,
  ResourceHealthProvider,
  ThermalHealthProvider,
  WorkloadHealthProvider,
} from './types.js';

/** Empty provider keeps IHIA independent until a composition root supplies published source adapters. */
export class NullHealthSignalProvider implements HealthSignalProvider {
  getHealthSignals(): HealthObservation[] {
    return [];
  }
}

/** Deterministic test and composition adapter. It has no knowledge of authority classes. */
export class MapHealthSignalProvider implements HealthSignalProvider {
  constructor(private readonly observations: HealthObservation[] = []) {}

  getHealthSignals(): HealthObservation[] {
    return this.observations.map((observation) => ({
      ...observation,
      categories: [...observation.categories],
      metrics: { ...observation.metrics },
      evidence: observation.evidence ? [...observation.evidence] : undefined,
      maintenanceHistory: observation.maintenanceHistory ? [...observation.maintenanceHistory] : undefined,
    }));
  }
}

export class InjectableHealthSignalProvider implements HealthSignalProvider {
  constructor(private readonly fn: () => HealthObservation[]) {}

  getHealthSignals(): HealthObservation[] {
    return this.fn();
  }
}

/** Explicit type aliases make composition-root intent clear without importing any other authority. */
export class InjectableHardwareHealthProvider extends InjectableHealthSignalProvider implements HardwareHealthProvider {}
export class InjectableResourceHealthProvider extends InjectableHealthSignalProvider implements ResourceHealthProvider {}
export class InjectableWorkloadHealthProvider extends InjectableHealthSignalProvider implements WorkloadHealthProvider {}
export class InjectablePowerHealthProvider extends InjectableHealthSignalProvider implements PowerHealthProvider {}
export class InjectableThermalHealthProvider extends InjectableHealthSignalProvider implements ThermalHealthProvider {}

export function collectHealthProviders(providers: HealthProviders = {}): HealthSignalProvider[] {
  return [providers.hardware, providers.resource, providers.workload, providers.power, providers.thermal, ...(providers.additional ?? [])]
    .filter((provider): provider is HealthSignalProvider => provider !== undefined);
}
