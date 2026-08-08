import { describe, expect, it } from 'vitest';
import {
  NullBenchmarkEvidenceProvider,
  NullDriverCompatibilityEvidenceProvider,
  NullErrorHistoryEvidenceProvider,
  NullHardwareCapabilityProvider,
  NullHealthEvidenceProvider,
  NullOperationalUptimeEvidenceProvider,
  NullPowerEvidenceProvider,
  NullResourceUtilizationEvidenceProvider,
  NullRuntimeStabilityEvidenceProvider,
  NullThermalEvidenceProvider,
  withDefaultCertificationProviders,
} from '../src/providers.js';

describe('IHCA provider contracts', () => {
  it('uses null structural providers only until a composition root supplies source adapters', () => {
    const defaults = withDefaultCertificationProviders();
    expect(defaults.benchmark).toBeInstanceOf(NullBenchmarkEvidenceProvider);
    expect(defaults.health).toBeInstanceOf(NullHealthEvidenceProvider);
    expect(defaults.power).toBeInstanceOf(NullPowerEvidenceProvider);
    expect(defaults.thermal).toBeInstanceOf(NullThermalEvidenceProvider);
    expect(defaults.hardwareCapabilities).toBeInstanceOf(NullHardwareCapabilityProvider);
    expect(defaults.resourceUtilization).toBeInstanceOf(NullResourceUtilizationEvidenceProvider);
    expect(defaults.errorHistory).toBeInstanceOf(NullErrorHistoryEvidenceProvider);
    expect(defaults.driverCompatibility).toBeInstanceOf(NullDriverCompatibilityEvidenceProvider);
    expect(defaults.runtimeStability).toBeInstanceOf(NullRuntimeStabilityEvidenceProvider);
    expect(defaults.operationalUptime).toBeInstanceOf(NullOperationalUptimeEvidenceProvider);
    expect(defaults.benchmark.getEvidence('hardware-001')).toEqual([]);
  });
});
