import type { BenchmarkComparison, BenchmarkExplanation, BenchmarkLifecycleRecord, BenchmarkRecommendation, BenchmarkRun, BenchmarkTypeDefinition } from './types.js';

export class BenchmarkAuditTrail {
  private records: BenchmarkLifecycleRecord[] = [];

  record(entry: BenchmarkLifecycleRecord): BenchmarkLifecycleRecord {
    const frozen = Object.freeze({ ...entry });
    this.records.push(frozen);
    return frozen;
  }

  all(): readonly BenchmarkLifecycleRecord[] {
    return this.records;
  }

  forRun(runId: string): BenchmarkLifecycleRecord[] {
    return this.records.filter((record) => record.runId === runId);
  }
}

/** §9 — completes the six mandatory explainability answers for every benchmark run. */
export function explainBenchmark(
  run: BenchmarkRun,
  definition: BenchmarkTypeDefinition,
  lifecycle: BenchmarkLifecycleRecord[],
  comparison?: BenchmarkComparison,
  recommendation?: BenchmarkRecommendation,
): BenchmarkExplanation {
  const result = run.result;
  const conditions = [
    `Device ${run.deviceId}`,
    run.environment.runtimeVersion ? `runtime ${run.environment.runtimeVersion}` : undefined,
    run.environment.miningAlgorithm ? `algorithm ${run.environment.miningAlgorithm}` : undefined,
    run.powerProfile.averageWatts !== undefined ? `${run.powerProfile.averageWatts} W average power` : undefined,
    run.thermalProfile.averageCelsius !== undefined ? `${run.thermalProfile.averageCelsius} °C average thermal condition` : undefined,
  ].filter((value): value is string => value !== undefined).join('; ');
  return {
    runId: run.runId,
    whatWasMeasured: `${definition.name} measured ${result ? `${result.metric}: ${result.value} ${result.unit}` : definition.metric} on ${run.component}.`,
    why: run.reason,
    conditions: conditions || 'No additional environment, power, or thermal conditions were supplied.',
    baseline: comparison?.baselineDescription ?? 'No comparison has been recorded.',
    whatChanged: comparison
      ? comparison.classification === 'no-baseline' ? 'No historical baseline is available yet.'
        : `${comparison.classification}: ${comparison.directionalChangePercent?.toFixed(2) ?? 'n/a'}% directional change.`
      : 'The run has not yet been compared.',
    recommendation: recommendation?.recommendation ?? 'No advisory recommendation has been generated.',
    lifecycle,
  };
}
