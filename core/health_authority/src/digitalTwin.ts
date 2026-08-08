import type {
  HealthCategory,
  HealthForecast,
  HealthProfile,
  HealthTwinDimension,
  InstitutionalHealthDigitalTwin,
  InstitutionalHealthStatus,
} from './types.js';

const CATEGORIES: HealthCategory[] = ['hardware', 'resource', 'thermal', 'power', 'runtime', 'plugin', 'database', 'storage', 'event-bus', 'scheduler'];
const STATUSES: InstitutionalHealthStatus[] = ['healthy', 'warning', 'critical', 'unknown'];

export interface InstitutionalHealthDigitalTwinContext {
  profiles: HealthProfile[];
  forecasts: HealthForecast[];
  now: string;
}

/** §11 — an institutional read model that combines published profiles and maintenance/reliability history. */
export function assembleInstitutionalHealthDigitalTwin(ctx: InstitutionalHealthDigitalTwinContext): InstitutionalHealthDigitalTwin {
  const workingDimensions = Object.fromEntries(CATEGORIES.map((category) => [category, emptyDimension(category)])) as Record<HealthCategory, MutableDimension>;
  for (const profile of ctx.profiles) {
    for (const category of profile.categories) {
      const dimension = workingDimensions[category];
      dimension.profileCount += 1;
      dimension.statuses[profile.currentHealth.status] += 1;
      dimension.evidence.push(...profile.evidence);
      dimension.scores.push(profile.currentHealth.overallScore);
    }
  }
  const dimensions = Object.fromEntries(CATEGORIES.map((category) => {
    const { scores, ...dimension } = workingDimensions[category];
    return [category, { ...dimension, averageScore: scores.length > 0 ? average(scores) : undefined }];
  })) as InstitutionalHealthDigitalTwin['dimensions'];
  const allScores = ctx.profiles.map((profile) => profile.currentHealth);
  const institutionalScore = allScores.length === 0 ? undefined : {
    overallScore: average(allScores.map((score) => score.overallScore)),
    reliabilityScore: average(allScores.map((score) => score.reliabilityScore)),
    stabilityScore: average(allScores.map((score) => score.stabilityScore)),
    performanceScore: average(allScores.map((score) => score.performanceScore)),
    availabilityScore: average(allScores.map((score) => score.availabilityScore)),
    status: statusFor(average(allScores.map((score) => score.overallScore))),
  };

  return {
    twinId: 'institutional-health',
    updatedAt: ctx.now,
    institutionalScore,
    componentProfiles: [...ctx.profiles],
    dimensions,
    reliabilityHistory: ctx.profiles.map(({ profileId, reliabilityTrend, failureCount, mtbfHours }) => ({ profileId, reliabilityTrend, failureCount, mtbfHours })),
    maintenanceHistory: ctx.profiles.flatMap((profile) => profile.maintenanceHistory).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    forecasts: [...ctx.forecasts],
  };
}

type MutableDimension = HealthTwinDimension & { scores: number[] };

function emptyDimension(category: HealthCategory): MutableDimension {
  return {
    category,
    profileCount: 0,
    statuses: { healthy: 0, warning: 0, critical: 0, unknown: 0 },
    evidence: [],
    scores: [],
  };
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function statusFor(score: number): InstitutionalHealthStatus {
  if (score >= 80) return 'healthy';
  if (score >= 50) return 'warning';
  return 'critical';
}
