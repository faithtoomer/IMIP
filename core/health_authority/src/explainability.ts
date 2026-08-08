import type { HealthAssessmentRecord, HealthExplanation, HealthForecast, HealthProfile } from './types.js';

/** Append-only assessment evidence owned by IHIA. */
export class HealthAuditTrail {
  private records: HealthAssessmentRecord[] = [];

  record(entry: HealthAssessmentRecord): HealthAssessmentRecord {
    const frozen = Object.freeze({ ...entry, evidence: [...entry.evidence] });
    this.records.push(frozen);
    return frozen;
  }

  all(): readonly HealthAssessmentRecord[] {
    return this.records;
  }

  forProfile(profileId: string): HealthAssessmentRecord[] {
    return this.records.filter((record) => record.profileId === profileId);
  }
}

/** §9 — every answer is grounded in source evidence and IHIA's advisory forecast. */
export function explainHealth(profile: HealthProfile, records: HealthAssessmentRecord[], forecast: HealthForecast): HealthExplanation {
  const latest = records.at(-1);
  const changed = latest?.previousScore
    ? `${latest.previousScore.overallScore.toFixed(1)} → ${profile.currentHealth.overallScore.toFixed(1)} overall health score.`
    : `Initial institutional health assessment is ${profile.currentHealth.overallScore.toFixed(1)}/100.`;
  const history = profile.historicalHealth;
  const historicalTrend = history.length < 2
    ? 'Historical trend is not yet established; fewer than two assessments are available.'
    : `${forecast.degradationTrend} trend at ${forecast.scoreChangePerObservation?.toFixed(1) ?? '0.0'} score points per observation.`;
  return {
    profileId: profile.profileId,
    whatChanged: changed,
    why: `IHIA applied its configured weights to scores published by ${profile.providerSource}; it did not redetect the underlying condition.`,
    supportingEvidence: [...profile.evidence],
    historicalTrend,
    forecast: forecast.expectedFailure
      ? `Advisory failure prediction${forecast.expectedFailureAt ? ` by ${forecast.expectedFailureAt}` : ''} (confidence ${(forecast.confidence * 100).toFixed(0)}%).`
      : `No advisory failure prediction (confidence ${(forecast.confidence * 100).toFixed(0)}%).`,
    recommendedAction: forecast.maintenanceRecommendation,
    evidence: records,
  };
}
