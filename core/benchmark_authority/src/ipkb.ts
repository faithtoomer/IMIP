import { randomUUID } from 'node:crypto';
import type {
  BenchmarkComparison,
  BenchmarkProviders,
  BenchmarkRun,
  EfficiencyFinding,
  InstitutionalPerformanceKnowledgeRecord,
  IPKBQuery,
} from './types.js';

/** §11 — a higher-level knowledge base, distinct from IHIS's raw per-device BenchmarkRegistry. */
export class InstitutionalPerformanceKnowledgeBase {
  private records = new Map<string, InstitutionalPerformanceKnowledgeRecord>();
  private knowledgeIdByRun = new Map<string, string>();

  record(run: BenchmarkRun, providers: BenchmarkProviders, comparison?: BenchmarkComparison): InstitutionalPerformanceKnowledgeRecord {
    if (!run.result) throw new Error(`Cannot correlate benchmark run ${run.runId} without an execution result.`);
    const existingKnowledgeId = this.knowledgeIdByRun.get(run.runId);
    const record: InstitutionalPerformanceKnowledgeRecord = Object.freeze({
      knowledgeId: existingKnowledgeId ?? randomUUID(),
      runId: run.runId,
      recordedAt: run.storedAt ?? run.result.recordedAt,
      benchmarkTypeId: run.benchmarkTypeId,
      benchmarkVersion: run.benchmarkVersion,
      category: run.category,
      component: run.component,
      deviceId: run.deviceId,
      metric: run.result.metric,
      value: run.result.value,
      unit: run.result.unit,
      correlation: Object.freeze({
        hardwareConfiguration: Object.freeze({ ...run.hardwareProfile }),
        resource: providers.resource?.getResourceSignal(run),
        power: providers.power?.getPowerProfile(run) ?? run.powerProfile,
        thermal: providers.thermal?.getThermalProfile(run) ?? run.thermalProfile,
        workload: providers.workload?.getWorkloadSignal(run),
        environment: Object.freeze({ ...run.environment }),
      }),
      comparison,
    });
    this.records.set(record.knowledgeId, record);
    this.knowledgeIdByRun.set(run.runId, record.knowledgeId);
    return record;
  }

  all(): InstitutionalPerformanceKnowledgeRecord[] {
    return [...this.records.values()].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.knowledgeId.localeCompare(b.knowledgeId));
  }

  forRun(runId: string): InstitutionalPerformanceKnowledgeRecord | undefined {
    return this.all().find((record) => record.runId === runId);
  }

  query(query: IPKBQuery = {}): InstitutionalPerformanceKnowledgeRecord[] {
    return this.all().filter((record) => (
      (query.benchmarkTypeId === undefined || record.benchmarkTypeId === query.benchmarkTypeId)
      && (query.component === undefined || record.component === query.component)
      && (query.deviceId === undefined || record.deviceId === query.deviceId)
      && (query.metric === undefined || record.metric === query.metric)
      && (query.miningAlgorithm === undefined || (record.correlation.workload?.miningAlgorithm ?? record.correlation.environment.miningAlgorithm) === query.miningAlgorithm)
      && (query.runtimeVersion === undefined || (record.correlation.workload?.runtimeVersion ?? record.correlation.environment.runtimeVersion) === query.runtimeVersion)
      && (query.configurationChange === undefined || record.correlation.workload?.configurationChanges?.includes(query.configurationChange) === true)
    ));
  }

  /** Answers “which configuration delivers the highest hashrate per watt?” from correlated institutional evidence. */
  highestHashratePerWatt(query: Omit<IPKBQuery, 'metric'> = {}): EfficiencyFinding | undefined {
    const findings: EfficiencyFinding[] = [];
    for (const record of this.query(query).filter((candidate) => /hashrate/i.test(candidate.metric))) {
      const watts = record.correlation.power?.averageWatts;
      if (watts !== undefined && watts > 0) {
        findings.push({
          knowledgeId: record.knowledgeId,
          runId: record.runId,
          component: record.component,
          deviceId: record.deviceId,
          metric: record.metric,
          value: record.value,
          unit: record.unit,
          watts,
          valuePerWatt: record.value / watts,
          miningAlgorithm: record.correlation.workload?.miningAlgorithm ?? record.correlation.environment.miningAlgorithm,
        });
      }
    }
    return findings.sort((a, b) => b.valuePerWatt - a.valuePerWatt || a.runId.localeCompare(b.runId))[0];
  }
}
