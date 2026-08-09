import type { StatisticsMetric } from './types.js';

export interface InstitutionalMiningTelemetryTrace {
  hardwareIdentifier: string;
  resourceUuid?: string;
  workloadUuid: string;
  minerProcessUuid?: string;
  adapterUuid: string;
  algorithmIdentifier: string;
  poolIdentifier?: string;
  metricUuid: string;
}

export interface TelemetryGraphNode { kind: 'hardware' | 'resource' | 'workload' | 'miner-process' | 'adapter' | 'algorithm' | 'pool' | 'statistics'; identifier: string; }

/** Queryable causal chain: Hardware -> Resource -> Workload -> Miner Process -> Adapter -> Algorithm -> Pool -> Statistics. */
export class InstitutionalMiningTelemetryGraph {
  private readonly traces = new Map<string, InstitutionalMiningTelemetryTrace>();

  record(metric: StatisticsMetric): void {
    this.traces.set(metric.metricUuid, Object.freeze({
      hardwareIdentifier: metric.hardwareIdentifier,
      resourceUuid: metric.resourceUuid,
      workloadUuid: metric.workloadUuid,
      minerProcessUuid: metric.minerProcessUuid,
      adapterUuid: metric.adapterUuid,
      algorithmIdentifier: metric.algorithmIdentifier,
      poolIdentifier: metric.poolIdentifier,
      metricUuid: metric.metricUuid,
    }));
  }

  traceMetric(metricUuid: string): InstitutionalMiningTelemetryTrace | undefined { return this.traces.get(metricUuid); }
  traceHardware(hardwareIdentifier: string): InstitutionalMiningTelemetryTrace[] { return [...this.traces.values()].filter((trace) => trace.hardwareIdentifier === hardwareIdentifier); }
  traceWorkload(workloadUuid: string): InstitutionalMiningTelemetryTrace[] { return [...this.traces.values()].filter((trace) => trace.workloadUuid === workloadUuid); }

  chain(metricUuid: string): TelemetryGraphNode[] {
    const trace = this.traces.get(metricUuid);
    if (!trace) return [];
    const nodes: TelemetryGraphNode[] = [{ kind: 'hardware', identifier: trace.hardwareIdentifier }];
    if (trace.resourceUuid) nodes.push({ kind: 'resource', identifier: trace.resourceUuid });
    nodes.push({ kind: 'workload', identifier: trace.workloadUuid });
    if (trace.minerProcessUuid) nodes.push({ kind: 'miner-process', identifier: trace.minerProcessUuid });
    nodes.push({ kind: 'adapter', identifier: trace.adapterUuid }, { kind: 'algorithm', identifier: trace.algorithmIdentifier });
    if (trace.poolIdentifier) nodes.push({ kind: 'pool', identifier: trace.poolIdentifier });
    nodes.push({ kind: 'statistics', identifier: trace.metricUuid });
    return nodes;
  }
}
