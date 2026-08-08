import type {
  BenchmarkEvidenceProvider,
  CertificationEvidence,
  CertificationEvidenceProvider,
  CertificationProviders,
  DriverCompatibilityEvidenceProvider,
  ErrorHistoryEvidenceProvider,
  HardwareCapabilityProvider,
  HealthEvidenceProvider,
  OperationalUptimeEvidenceProvider,
  PowerEvidenceProvider,
  ResourceUtilizationEvidenceProvider,
  RuntimeStabilityEvidenceProvider,
  ThermalEvidenceProvider,
} from './types.js';

/**
 * Null providers are deliberately structural. They retain no authority state and
 * let a composition root supply published evidence views at runtime.
 */
export class NullCertificationEvidenceProvider implements CertificationEvidenceProvider {
  getEvidence(_hardwareUuid: string): CertificationEvidence[] {
    return [];
  }
}

export class NullBenchmarkEvidenceProvider extends NullCertificationEvidenceProvider implements BenchmarkEvidenceProvider {}
export class NullHealthEvidenceProvider extends NullCertificationEvidenceProvider implements HealthEvidenceProvider {}
export class NullPowerEvidenceProvider extends NullCertificationEvidenceProvider implements PowerEvidenceProvider {}
export class NullThermalEvidenceProvider extends NullCertificationEvidenceProvider implements ThermalEvidenceProvider {}
export class NullHardwareCapabilityProvider extends NullCertificationEvidenceProvider implements HardwareCapabilityProvider {}
export class NullResourceUtilizationEvidenceProvider extends NullCertificationEvidenceProvider implements ResourceUtilizationEvidenceProvider {}
export class NullErrorHistoryEvidenceProvider extends NullCertificationEvidenceProvider implements ErrorHistoryEvidenceProvider {}
export class NullDriverCompatibilityEvidenceProvider extends NullCertificationEvidenceProvider implements DriverCompatibilityEvidenceProvider {}
export class NullRuntimeStabilityEvidenceProvider extends NullCertificationEvidenceProvider implements RuntimeStabilityEvidenceProvider {}
export class NullOperationalUptimeEvidenceProvider extends NullCertificationEvidenceProvider implements OperationalUptimeEvidenceProvider {}

export function withDefaultCertificationProviders(providers: CertificationProviders = {}): Required<CertificationProviders> {
  return {
    benchmark: providers.benchmark ?? new NullBenchmarkEvidenceProvider(),
    health: providers.health ?? new NullHealthEvidenceProvider(),
    power: providers.power ?? new NullPowerEvidenceProvider(),
    thermal: providers.thermal ?? new NullThermalEvidenceProvider(),
    hardwareCapabilities: providers.hardwareCapabilities ?? new NullHardwareCapabilityProvider(),
    resourceUtilization: providers.resourceUtilization ?? new NullResourceUtilizationEvidenceProvider(),
    errorHistory: providers.errorHistory ?? new NullErrorHistoryEvidenceProvider(),
    driverCompatibility: providers.driverCompatibility ?? new NullDriverCompatibilityEvidenceProvider(),
    runtimeStability: providers.runtimeStability ?? new NullRuntimeStabilityEvidenceProvider(),
    operationalUptime: providers.operationalUptime ?? new NullOperationalUptimeEvidenceProvider(),
  };
}

/** Collects source-owned observations in a stable order, without retaining source adapters. */
export function collectCertificationEvidence(
  providers: Required<CertificationProviders>,
  hardwareUuid: string,
): CertificationEvidence[] {
  return [
    ...providers.hardwareCapabilities.getEvidence(hardwareUuid),
    ...providers.benchmark.getEvidence(hardwareUuid),
    ...providers.health.getEvidence(hardwareUuid),
    ...providers.power.getEvidence(hardwareUuid),
    ...providers.thermal.getEvidence(hardwareUuid),
    ...providers.resourceUtilization.getEvidence(hardwareUuid),
    ...providers.errorHistory.getEvidence(hardwareUuid),
    ...providers.driverCompatibility.getEvidence(hardwareUuid),
    ...providers.runtimeStability.getEvidence(hardwareUuid),
    ...providers.operationalUptime.getEvidence(hardwareUuid),
  ].map((evidence) => ({
    ...evidence,
    metrics: { ...evidence.metrics },
    references: evidence.references ? [...evidence.references] : undefined,
    details: evidence.details ? { ...evidence.details } : undefined,
  })).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
}
