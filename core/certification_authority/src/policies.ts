import type {
  CertificationEvidence,
  CertificationEvidenceType,
  CertificationLevel,
  CertificationLevelRequirements,
  CertificationPolicy,
  CertificationPolicyContext,
  CertificationPolicyResult,
  EvidenceMetric,
} from './types.js';

export const DEFAULT_CERTIFICATION_LEVEL_REQUIREMENTS: Readonly<Record<CertificationLevel, CertificationLevelRequirements>> = Object.freeze({
  experimental: {
    minimumEvidence: 1,
    metricThresholds: { stabilityScore: 40, reliabilityScore: 40, compatibilityScore: 40 },
  },
  development: {
    minimumEvidence: 2,
    metricThresholds: { stabilityScore: 50, reliabilityScore: 50, compatibilityScore: 50, healthScore: 50 },
  },
  qualified: {
    minimumEvidence: 4,
    metricThresholds: {
      stabilityScore: 60,
      reliabilityScore: 60,
      compatibilityScore: 60,
      thermalStabilityScore: 60,
      powerEfficiencyScore: 60,
    },
  },
  production: {
    minimumEvidence: 6,
    metricThresholds: {
      stabilityScore: 75,
      reliabilityScore: 75,
      compatibilityScore: 75,
      thermalStabilityScore: 75,
      powerEfficiencyScore: 75,
      errorHistoryScore: 75,
      operationalUptimeScore: 75,
      runtimeStabilityScore: 75,
    },
    requiredEvidenceTypes: ['benchmark', 'health', 'power', 'thermal', 'driver-compatibility', 'runtime-stability', 'operational-uptime'],
  },
  'mission-critical': {
    minimumEvidence: 8,
    metricThresholds: {
      benchmarkScore: 90,
      healthScore: 90,
      powerEfficiencyScore: 90,
      thermalStabilityScore: 90,
      reliabilityScore: 90,
      stabilityScore: 90,
      compatibilityScore: 90,
      resourceUtilizationScore: 90,
      errorHistoryScore: 90,
      runtimeStabilityScore: 90,
      operationalUptimeScore: 90,
      capabilityScore: 90,
    },
    requiredEvidenceTypes: [
      'hardware-capability',
      'benchmark',
      'health',
      'power',
      'thermal',
      'resource-utilization',
      'error-history',
      'driver-compatibility',
      'runtime-stability',
      'operational-uptime',
    ],
  },
});

/** A generic, configurable policy implementation; thresholds live in policy data. */
export class ThresholdCertificationPolicy implements CertificationPolicy {
  constructor(
    readonly level: CertificationLevel,
    readonly requirements: CertificationLevelRequirements,
    readonly name = `${level}-certification-policy`,
  ) {}

  evaluate(context: CertificationPolicyContext): CertificationPolicyResult {
    const requirementResults = [
      {
        requirement: `At least ${this.requirements.minimumEvidence} immutable evidence observation(s) attached`,
        passed: context.evidence.length >= this.requirements.minimumEvidence,
        observed: context.evidence.length,
        required: this.requirements.minimumEvidence,
        evidenceTypes: uniqueEvidenceTypes(context.evidence),
        rationale: `${context.evidence.length} immutable evidence observation(s) were evaluated.`,
      },
      ...Object.entries(this.requirements.metricThresholds).map(([metric, threshold]) => {
        const observed = context.aggregateMetrics[metric as EvidenceMetric];
        const hasScore = observed !== undefined;
        return {
          requirement: `${metric} is at least ${threshold}`,
          passed: hasScore && observed >= threshold,
          observed,
          required: threshold,
          evidenceTypes: evidenceTypesForMetric(context.evidence, metric as EvidenceMetric),
          rationale: hasScore
            ? `${metric} aggregated to ${observed}; required threshold is ${threshold}.`
            : `${metric} was not supplied by attached evidence; required threshold is ${threshold}.`,
        };
      }),
      ...(this.requirements.requiredEvidenceTypes ?? []).map((type) => {
        const present = context.evidence.some((evidence) => evidence.type === type);
        return {
          requirement: `${type} evidence is present`,
          passed: present,
          evidenceTypes: [type],
          rationale: present ? `${type} evidence was attached.` : `No ${type} evidence was attached.`,
        };
      }),
    ];
    const eligible = requirementResults.every((result) => result.passed);
    return {
      policyName: this.name,
      level: this.level,
      eligible,
      requirements: requirementResults,
      rationale: [
        `Applied configurable ${this.name}.`,
        eligible
          ? `All ${requirementResults.length} requirements passed for ${this.level}.`
          : `${requirementResults.filter((result) => !result.passed).length} requirement(s) failed for ${this.level}.`,
      ],
    };
  }
}

export class PolicyRegistry {
  private readonly policies = new Map<CertificationLevel, CertificationPolicy>();

  constructor(policies: CertificationPolicy[] = defaultCertificationPolicies()) {
    for (const policy of policies) this.register(policy);
  }

  register(policy: CertificationPolicy): void {
    this.policies.set(policy.level, policy);
  }

  remove(level: CertificationLevel): boolean {
    return this.policies.delete(level);
  }

  get(level: CertificationLevel): CertificationPolicy | undefined {
    return this.policies.get(level);
  }

  require(level: CertificationLevel): CertificationPolicy {
    const policy = this.get(level);
    if (!policy) throw new Error(`No certification policy is registered for level ${level}.`);
    return policy;
  }

  all(): CertificationPolicy[] {
    return [...this.policies.values()].sort((left, right) => left.level.localeCompare(right.level));
  }
}

export function defaultCertificationPolicies(
  requirements: Readonly<Record<CertificationLevel, CertificationLevelRequirements>> = DEFAULT_CERTIFICATION_LEVEL_REQUIREMENTS,
): CertificationPolicy[] {
  return (Object.keys(requirements) as CertificationLevel[])
    .map((level) => new ThresholdCertificationPolicy(level, requirements[level]));
}

/** Mean scores make policy evaluation stable across provider ordering. */
export function aggregateEvidenceMetrics(
  evidence: readonly CertificationEvidence[],
): Partial<Record<EvidenceMetric, number>> {
  const values = new Map<EvidenceMetric, number[]>();
  for (const observation of evidence) {
    for (const [metric, value] of Object.entries(observation.metrics) as Array<[EvidenceMetric, number | undefined]>) {
      if (value === undefined || !Number.isFinite(value)) continue;
      const scores = values.get(metric) ?? [];
      scores.push(clampScore(value));
      values.set(metric, scores);
    }
  }
  return Object.fromEntries([...values.entries()]
    .map(([metric, scores]) => [metric, round(scores.reduce((sum, score) => sum + score, 0) / scores.length)])) as Partial<Record<EvidenceMetric, number>>;
}

function uniqueEvidenceTypes(evidence: readonly CertificationEvidence[]): CertificationEvidenceType[] {
  return [...new Set(evidence.map((observation) => observation.type))].sort();
}

function evidenceTypesForMetric(
  evidence: readonly CertificationEvidence[],
  metric: EvidenceMetric,
): CertificationEvidenceType[] {
  return [...new Set(evidence.filter((observation) => observation.metrics[metric] !== undefined).map((observation) => observation.type))].sort();
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
