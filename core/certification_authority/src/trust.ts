import { aggregateEvidenceMetrics } from './policies.js';
import type {
  CertificationEvidence,
  CertificationEvidenceType,
  EvidenceMetric,
  HardwareTrustScore,
  TrustDimension,
} from './types.js';

const IHTM_DIMENSIONS: ReadonlyArray<readonly [CertificationEvidenceType, EvidenceMetric[]]> = Object.freeze([
  ['hardware-capability', ['capabilityScore']],
  ['benchmark', ['benchmarkScore']],
  ['health', ['healthScore', 'reliabilityScore', 'stabilityScore']],
  ['power', ['powerEfficiencyScore']],
  ['thermal', ['thermalStabilityScore']],
  ['resource-utilization', ['resourceUtilizationScore']],
  ['error-history', ['errorHistoryScore']],
  ['driver-compatibility', ['compatibilityScore']],
  ['runtime-stability', ['runtimeStabilityScore']],
  ['operational-uptime', ['operationalUptimeScore']],
]);

/**
 * IHTM owns only its composed read model. It does not mutate, schedule, allocate,
 * or otherwise take ownership of any source authority's observations.
 */
export class InstitutionalHardwareTrustModel {
  private readonly scores = new Map<string, HardwareTrustScore>();

  update(hardwareUuid: string, evidence: readonly CertificationEvidence[], updatedAt: string): HardwareTrustScore {
    const aggregate = aggregateEvidenceMetrics(evidence);
    const dimensions: TrustDimension[] = IHTM_DIMENSIONS.map(([type, metrics]) => {
      const supporting = evidence.filter((observation) => observation.type === type);
      const values = metrics.map((metric) => aggregate[metric]).filter((value): value is number => value !== undefined);
      return {
        evidenceType: type,
        score: values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : undefined,
        evidenceRefs: supporting.map((observation) => observation.evidenceId).sort(),
      };
    });
    const scored = dimensions.map((dimension) => dimension.score).filter((score): score is number => score !== undefined);
    const sourceCount = new Set(evidence.map((observation) => observation.source)).size;
    const coverage = dimensions.filter((dimension) => dimension.score !== undefined).length / dimensions.length;
    const trust: HardwareTrustScore = deepFreeze({
      hardwareUuid,
      score: scored.length ? round(scored.reduce((sum, score) => sum + score, 0) / scored.length) : 0,
      certificationConfidence: {
        value: round(coverage * 100),
        evidenceCoverage: round(coverage * 100),
        sourceCount,
        complete: coverage === 1,
        rationale: [
          `${dimensions.filter((dimension) => dimension.score !== undefined).length} of ${dimensions.length} IHTM dimensions have scored evidence.`,
          `${sourceCount} evidence source(s) contributed to the trust read model.`,
        ],
      },
      dimensions,
      evidenceRefs: evidence.map((observation) => observation.evidenceId).sort(),
      updatedAt,
    });
    this.scores.set(hardwareUuid, trust);
    return trust;
  }

  get(hardwareUuid: string): HardwareTrustScore | undefined {
    return this.scores.get(hardwareUuid);
  }

  all(): HardwareTrustScore[] {
    return [...this.scores.values()].sort((left, right) => left.hardwareUuid.localeCompare(right.hardwareUuid));
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return value;
}
