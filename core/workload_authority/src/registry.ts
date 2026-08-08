import type { WorkloadProfile, WorkloadState, WorkloadType } from './types.js';
import { WorkloadNotFoundError } from './errors.js';

/** §6 — authoritative store of workload profiles, keyed by workload UUID. */
export class WorkloadRegistry {
  private workloads = new Map<string, WorkloadProfile>();

  upsert(profile: WorkloadProfile): void {
    this.workloads.set(profile.workloadId, profile);
  }

  remove(workloadId: string): boolean {
    return this.workloads.delete(workloadId);
  }

  get(workloadId: string): WorkloadProfile | undefined {
    return this.workloads.get(workloadId);
  }

  require(workloadId: string): WorkloadProfile {
    const profile = this.workloads.get(workloadId);
    if (!profile) throw new WorkloadNotFoundError(workloadId);
    return profile;
  }

  all(): WorkloadProfile[] {
    return [...this.workloads.values()].sort((a, b) => a.workloadId.localeCompare(b.workloadId));
  }

  ids(): string[] {
    return [...this.workloads.keys()].sort();
  }

  byType(type: WorkloadType): WorkloadProfile[] {
    return this.all().filter((profile) => profile.type === type);
  }

  byState(state: WorkloadState): WorkloadProfile[] {
    return this.all().filter((profile) => profile.state === state);
  }

  byOwner(owner: string): WorkloadProfile[] {
    return this.all().filter((profile) => profile.owner === owner);
  }

  dependentOn(workloadId: string): WorkloadProfile[] {
    return this.all().filter((profile) => profile.dependencies.includes(workloadId));
  }
}
