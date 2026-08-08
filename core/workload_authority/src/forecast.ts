import type { WorkloadForecast, WorkloadHistoryEntry, WorkloadProfile, WorkloadTelemetrySample } from './types.js';

export interface WorkloadForecastContext {
  profile: WorkloadProfile;
  history: WorkloadHistoryEntry[];
  telemetry: WorkloadTelemetrySample[];
  now: string;
}

/** §7 — advisory completion forecast from governed duration and historical evidence. */
export function computeWorkloadForecast(ctx: WorkloadForecastContext): WorkloadForecast {
  const { profile, history, telemetry, now } = ctx;
  const basis: string[] = [];
  const historicDuration = profile.historicalPerformance.averageDurationMs;
  const durationMs = historicDuration ?? profile.estimatedDurationMs;
  basis.push(
    historicDuration !== undefined
      ? `Historical average duration of ${Math.round(historicDuration)} ms.`
      : `Estimated duration of ${Math.round(profile.estimatedDurationMs)} ms.`,
  );

  const terminalAt = profile.completedAt ?? profile.failedAt;
  if (terminalAt) {
    basis.push(`Terminal outcome recorded at ${terminalAt}.`);
    return {
      workloadId: profile.workloadId,
      forecastedAt: now,
      predictedCompletionAt: terminalAt,
      estimatedRemainingMs: 0,
      confidence: 1,
      basis,
    };
  }

  let predictedCompletionAt: string | undefined;
  let estimatedRemainingMs: number | undefined;
  if (profile.startedAt) {
    const elapsed = Math.max(0, Date.parse(now) - Date.parse(profile.startedAt));
    estimatedRemainingMs = Math.max(0, durationMs - elapsed);
    predictedCompletionAt = new Date(Date.parse(profile.startedAt) + durationMs).toISOString();
    basis.push(`Elapsed runtime is ${Math.round(elapsed)} ms since ${profile.startedAt}.`);
  } else {
    basis.push('Workload has not started; completion time cannot yet be projected.');
  }

  const queued = history.find((entry) => entry.action === 'queued');
  const assigned = history.find((entry) => entry.action === 'assigned');
  const queueDelayMs = queued && assigned ? Math.max(0, Date.parse(assigned.timestamp) - Date.parse(queued.timestamp)) : undefined;
  if (queueDelayMs !== undefined) basis.push(`Observed queue delay is ${queueDelayMs} ms.`);

  const totalRuns = profile.historicalPerformance.completedRuns + profile.historicalPerformance.failedRuns;
  const confidence = totalRuns >= 5 ? 0.85 : totalRuns > 0 ? 0.65 : telemetry.length > 0 ? 0.5 : 0.35;
  return {
    workloadId: profile.workloadId,
    forecastedAt: now,
    predictedCompletionAt,
    estimatedRemainingMs,
    queueDelayMs,
    confidence,
    basis,
  };
}
