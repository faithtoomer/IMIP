import { randomUUID } from 'node:crypto';
import type { BenchmarkComparison, BenchmarkDirection, BenchmarkRun } from './types.js';

export interface ComparisonOptions {
  regressionThresholdPercent?: number;
  now?: string;
}

/** Historical comparisons are directional so latency and throughput benchmarks both work correctly. */
export function compareBenchmarkRuns(
  current: BenchmarkRun,
  baseline: BenchmarkRun | undefined,
  direction: BenchmarkDirection,
  options: ComparisonOptions = {},
): BenchmarkComparison {
  const currentResult = requiredResult(current);
  const baselineResult = baseline ? requiredResult(baseline) : undefined;
  if (!baseline || !baselineResult) {
    return {
      comparisonId: randomUUID(),
      runId: current.runId,
      metric: currentResult.metric,
      unit: currentResult.unit,
      currentValue: currentResult.value,
      directionalChange: 0,
      classification: 'no-baseline',
      regressionDetected: false,
      baselineDescription: 'No comparable historical baseline is available.',
      comparedAt: options.now ?? new Date().toISOString(),
    };
  }
  const baselineRun = baseline;
  const rawChange = currentResult.value - baselineResult.value;
  const directionalChange = direction === 'higher-is-better' ? rawChange : -rawChange;
  const directionalChangePercent = baselineResult.value === 0
    ? undefined
    : (directionalChange / Math.abs(baselineResult.value)) * 100;
  const threshold = options.regressionThresholdPercent ?? 5;
  const regressionDetected = directionalChangePercent !== undefined && directionalChangePercent <= -Math.abs(threshold);
  const classification = regressionDetected ? 'regressed'
    : directionalChangePercent !== undefined && directionalChangePercent >= Math.abs(threshold) ? 'improved'
      : 'stable';
  return {
    comparisonId: randomUUID(),
    runId: current.runId,
    baselineRunId: baselineRun.runId,
    metric: currentResult.metric,
    unit: currentResult.unit,
    currentValue: currentResult.value,
    baselineValue: baselineResult.value,
    directionalChange,
    directionalChangePercent,
    classification,
    regressionDetected,
    baselineDescription: `Comparable ${baselineRun.benchmarkTypeId} v${baselineRun.benchmarkVersion} run ${baselineRun.runId}.`,
    comparedAt: options.now ?? new Date().toISOString(),
  };
}

export function performanceTrend(runs: BenchmarkRun[], direction: BenchmarkDirection): 'improving' | 'stable' | 'declining' | 'insufficient-data' {
  const comparable = runs.filter((run) => run.result !== undefined).sort((a, b) => a.executedAt?.localeCompare(b.executedAt ?? '') ?? 0);
  if (comparable.length < 2) return 'insufficient-data';
  const first = requiredResult(comparable[0]!);
  const last = requiredResult(comparable.at(-1)!);
  const change = direction === 'higher-is-better' ? last.value - first.value : first.value - last.value;
  const percent = first.value === 0 ? 0 : (change / Math.abs(first.value)) * 100;
  if (percent >= 5) return 'improving';
  if (percent <= -5) return 'declining';
  return 'stable';
}

function requiredResult(run: BenchmarkRun) {
  if (!run.result) throw new Error(`Benchmark run ${run.runId} has no execution result.`);
  return run.result;
}
