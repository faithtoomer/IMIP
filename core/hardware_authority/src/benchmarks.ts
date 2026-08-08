import type { BenchmarkResult, BenchmarkSummary } from './types.js';

/**
 * §11 — Benchmark Framework. Benchmark *execution* policy is out of scope for
 * IHIS ("Benchmark execution policies are defined elsewhere"); this registry
 * stores and exposes results submitted by whatever benchmarking workflow runs
 * them (a future Mining/Workload Authority concern).
 */
export class BenchmarkRegistry {
  private results: BenchmarkResult[] = [];

  record(result: BenchmarkResult): void {
    this.results.push(Object.freeze({ ...result }));
  }

  forDevice(deviceId: string): BenchmarkResult[] {
    return this.results.filter((r) => r.deviceId === deviceId);
  }

  summarize(deviceId: string): BenchmarkSummary {
    const deviceResults = this.forDevice(deviceId);
    const latestByWorkload: Record<string, BenchmarkResult> = {};
    const bestByWorkload: Record<string, BenchmarkResult> = {};

    for (const result of deviceResults) {
      const currentLatest = latestByWorkload[result.workload];
      if (!currentLatest || result.recordedAt > currentLatest.recordedAt) {
        latestByWorkload[result.workload] = result;
      }
      const currentBest = bestByWorkload[result.workload];
      if (!currentBest || result.value > currentBest.value) {
        bestByWorkload[result.workload] = result;
      }
    }

    return { latestByWorkload, bestByWorkload, totalResults: deviceResults.length };
  }
}
