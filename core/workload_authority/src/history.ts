import type { WorkloadHistoryEntry } from './types.js';

/** Append-only workload history owned by IWIA (§3). */
export class WorkloadHistoryStore {
  private entries: WorkloadHistoryEntry[] = [];

  append(entry: WorkloadHistoryEntry): WorkloadHistoryEntry {
    const frozen = Object.freeze({ ...entry });
    this.entries.push(frozen);
    return frozen;
  }

  all(): readonly WorkloadHistoryEntry[] {
    return this.entries;
  }

  forWorkload(workloadId: string): WorkloadHistoryEntry[] {
    return this.entries.filter((entry) => entry.workloadId === workloadId);
  }

  byKind(kind: WorkloadHistoryEntry['kind']): WorkloadHistoryEntry[] {
    return this.entries.filter((entry) => entry.kind === kind);
  }
}
