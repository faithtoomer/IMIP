import { CertificationAuthority, type CertificationAuthorityOptions } from '../src/CertificationAuthority.js';
import type {
  CertificationEvidence,
  CertificationEvidenceType,
  CertificationProviders,
  CertificationRequest,
} from '../src/types.js';

export function makeClock(start = '2026-08-08T20:00:00.000Z') {
  let value = Date.parse(start);
  return {
    now: () => new Date(value).toISOString(),
    advance: (milliseconds: number) => { value += milliseconds; },
  };
}

export function makeRequest(overrides: Partial<CertificationRequest> = {}): CertificationRequest {
  return {
    hardwareUuid: 'hardware-001',
    deviceType: 'gpu',
    level: 'production',
    auditorVersion: 'ihca-policy-v1',
    recertificationIntervalDays: 30,
    notes: ['initial institutional evaluation'],
    ...overrides,
  };
}

const metricForType: Record<CertificationEvidenceType, string> = {
  'hardware-capability': 'capabilityScore',
  benchmark: 'benchmarkScore',
  health: 'healthScore',
  power: 'powerEfficiencyScore',
  thermal: 'thermalStabilityScore',
  'resource-utilization': 'resourceUtilizationScore',
  'error-history': 'errorHistoryScore',
  'driver-compatibility': 'compatibilityScore',
  'runtime-stability': 'runtimeStabilityScore',
  'operational-uptime': 'operationalUptimeScore',
};

export function makeEvidence(
  type: CertificationEvidenceType,
  score = 100,
  suffix = '1',
): CertificationEvidence {
  const metrics: Record<string, number> = { [metricForType[type]]: score };
  if (type === 'health') {
    metrics.reliabilityScore = score;
    metrics.stabilityScore = score;
  }
  if (type === 'driver-compatibility') metrics.compatibilityScore = score;
  if (type === 'runtime-stability') {
    metrics.runtimeStabilityScore = score;
    metrics.stabilityScore = score;
  }
  return {
    evidenceId: `${type}-${suffix}`,
    type,
    source: `${type}-fake-provider`,
    observedAt: '2026-08-08T19:00:00.000Z',
    metrics,
    references: [`${type}-reference-${suffix}`],
    details: { sourceObservation: suffix },
  };
}

export function fullEvidence(score = 100, suffix = '1'): CertificationEvidence[] {
  return (Object.keys(metricForType) as CertificationEvidenceType[]).map((type) => makeEvidence(type, score, suffix));
}

export function fakeProviders(
  evidence: CertificationEvidence[] = fullEvidence(),
  overrides: Partial<CertificationProviders> = {},
): CertificationProviders {
  const byType = (type: CertificationEvidenceType) => ({
    getEvidence: () => evidence.filter((observation) => observation.type === type),
  });
  return {
    hardwareCapabilities: byType('hardware-capability'),
    benchmark: byType('benchmark'),
    health: byType('health'),
    power: byType('power'),
    thermal: byType('thermal'),
    resourceUtilization: byType('resource-utilization'),
    errorHistory: byType('error-history'),
    driverCompatibility: byType('driver-compatibility'),
    runtimeStability: byType('runtime-stability'),
    operationalUptime: byType('operational-uptime'),
    ...overrides,
  };
}

export function providersFromEvidence(getAllEvidence: () => CertificationEvidence[]): CertificationProviders {
  const byType = (type: CertificationEvidenceType) => ({
    getEvidence: () => getAllEvidence().filter((observation) => observation.type === type),
  });
  return {
    hardwareCapabilities: byType('hardware-capability'),
    benchmark: byType('benchmark'),
    health: byType('health'),
    power: byType('power'),
    thermal: byType('thermal'),
    resourceUtilization: byType('resource-utilization'),
    errorHistory: byType('error-history'),
    driverCompatibility: byType('driver-compatibility'),
    runtimeStability: byType('runtime-stability'),
    operationalUptime: byType('operational-uptime'),
  };
}

export function makeAuthority(options: CertificationAuthorityOptions = {}): CertificationAuthority {
  return new CertificationAuthority({
    ...options,
    now: options.now ?? (() => '2026-08-08T20:00:00.000Z'),
    providers: fakeProviders(fullEvidence(), options.providers),
  });
}

export function evaluateAndCertify(authority = makeAuthority(), request = makeRequest()) {
  const started = authority.start(request);
  const decision = authority.evaluate(started.certificationId);
  authority.qualify(started.certificationId);
  const certified = authority.certify(started.certificationId);
  return { authority, started, decision, certified };
}
