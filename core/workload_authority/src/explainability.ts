import type { WorkloadAuditRecord, WorkloadExplanation, WorkloadProfile } from './types.js';

/**
 * §9 — immutable evidence for why workloads were created, assigned, prioritized,
 * completed, or failed. The answers are workload-side and never allocate resources.
 */
export class WorkloadAuditTrail {
  private records: WorkloadAuditRecord[] = [];

  record(entry: WorkloadAuditRecord): WorkloadAuditRecord {
    const frozen = Object.freeze({ ...entry });
    this.records.push(frozen);
    return frozen;
  }

  all(): readonly WorkloadAuditRecord[] {
    return this.records;
  }

  forWorkload(workloadId: string): WorkloadAuditRecord[] {
    return this.records.filter((record) => record.workloadId === workloadId);
  }
}

export function explainWorkload(profile: WorkloadProfile, records: WorkloadAuditRecord[]): WorkloadExplanation {
  const assignment = [...records].reverse().find((record) => record.kind === 'assigned');
  const completion = [...records].reverse().find((record) => record.kind === 'completed');
  const failure = [...records].reverse().find((record) => record.kind === 'failed');
  const resources = profile.assignedResources;

  return {
    workloadId: profile.workloadId,
    created: `Created because: ${profile.createdReason}`,
    assigned: assignment
      ? `Assigned because: ${assignment.reason ?? 'an external assignment was confirmed.'}`
      : 'Not assigned; no external resource assignment has been confirmed.',
    resource:
      resources.length > 0
        ? `Resource evidence: ${resources.map((resource) => {
            const rank = resource.providerRank === undefined ? '' : ` (provider rank ${resource.providerRank})`;
            const rationale = resource.providerExplanation?.length ? ` — ${resource.providerExplanation.join(' ')}` : '';
            return `${resource.resourceId}${rank}${rationale}`;
          }).join('; ')}`
        : 'No resource has been assigned; IWIA cannot claim or allocate resources itself.',
    priority: `Priority ${profile.priority}/100 because: ${profile.priorityReason}`,
    completed: completion
      ? `Completed because: ${completion.reason ?? 'the workload reported successful completion.'}`
      : 'Not completed; no successful completion has been recorded.',
    failed: failure
      ? `Failed because: ${failure.reason ?? 'the workload reported a failure.'}`
      : 'Not failed; no failure has been recorded.',
    evidence: records,
  };
}
