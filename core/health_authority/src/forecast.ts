import type { HealthForecast, HealthProfile } from './types.js';

/** §7 — advisory degradation/failure forecast. It emits no control action. */
export function computeHealthForecast(profile: HealthProfile, now: string): HealthForecast {
  const history = [...profile.historicalHealth].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const basis = [`Current institutional score is ${profile.currentHealth.overallScore.toFixed(1)}/100.`];
  if (history.length < 2) {
    return {
      profileId: profile.profileId,
      componentId: profile.componentId,
      providerSource: profile.providerSource,
      forecastedAt: now,
      degradationTrend: 'unknown',
      expectedFailure: profile.currentHealth.status === 'critical',
      confidence: profile.currentHealth.status === 'critical' ? 0.5 : 0.2,
      maintenanceRecommendation: recommendation(profile.currentHealth.status, 'unknown'),
      basis: [...basis, 'At least two institutional assessments are required to establish a degradation trend.'],
      advisory: true,
    };
  }

  const first = history[0]!;
  const latest = history.at(-1)!;
  const changePerObservation = (latest.score.overallScore - first.score.overallScore) / (history.length - 1);
  const degradationTrend = changePerObservation <= -2 ? 'degrading' : changePerObservation >= 2 ? 'improving' : 'stable';
  basis.push(`Score changed ${changePerObservation.toFixed(1)} points per observation across ${history.length} assessments.`);
  const expectedFailure = profile.currentHealth.status === 'critical' || (degradationTrend === 'degrading' && profile.currentHealth.overallScore <= 60);
  const expectedFailureAt = expectedFailure && changePerObservation < 0
    ? projectFailureAt(latest.observedAt, history, latest.score.overallScore, changePerObservation)
    : undefined;
  if (expectedFailure) basis.push('Prediction is advisory evidence for inspection and maintenance planning only.');

  return {
    profileId: profile.profileId,
    componentId: profile.componentId,
    providerSource: profile.providerSource,
    forecastedAt: now,
    degradationTrend,
    scoreChangePerObservation: changePerObservation,
    expectedFailure,
    expectedFailureAt,
    confidence: Math.min(0.95, 0.35 + Math.min(history.length, 6) * 0.1 + (expectedFailure ? 0.1 : 0)),
    maintenanceRecommendation: recommendation(profile.currentHealth.status, degradationTrend),
    basis,
    advisory: true,
  };
}

function projectFailureAt(latestAt: string, history: HealthProfile['historicalHealth'], currentScore: number, change: number): string | undefined {
  const previousAt = history.at(-2)?.observedAt;
  if (!previousAt) return undefined;
  const intervalMs = Math.max(1, Date.parse(latestAt) - Date.parse(previousAt));
  const observationsToCritical = Math.max(0, (50 - currentScore) / change);
  return new Date(Date.parse(latestAt) + Math.ceil(observationsToCritical * intervalMs)).toISOString();
}

function recommendation(status: HealthProfile['currentHealth']['status'], trend: HealthForecast['degradationTrend']): string {
  if (status === 'critical') return 'Advisory: inspect promptly and plan corrective maintenance; IHIA does not execute actions.';
  if (trend === 'degrading') return 'Advisory: schedule preventative maintenance and continue monitoring the published source signals.';
  if (status === 'warning') return 'Advisory: review supporting evidence during the next operational inspection.';
  return 'Advisory: continue routine monitoring; no action is initiated by IHIA.';
}
