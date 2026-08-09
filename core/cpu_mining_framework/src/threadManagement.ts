import { CpuMiningValidationError } from './errors.js';
import type { CpuAffinityPreference, CpuProfile, CpuThreadGrant, CpuThreadPlacement } from './types.js';
/** Placement planner only: receives an IRIA grant and never reserves, releases, or self-grants threads. */
export class ThreadManagement {
  plan(profile: CpuProfile, grant: CpuThreadGrant, preference: CpuAffinityPreference = { strategy: 'compact' }): CpuThreadPlacement {
    if (grant.cpuUuid !== profile.cpuUuid || grant.grantedThreadIds.length === 0) throw new CpuMiningValidationError('Thread placement requires a non-empty IRIA grant for the composed CPU.');
    const granted = [...new Set(grant.grantedThreadIds)].sort((a, b) => a - b);
    const preferred = (preference.preferredThreadIds ?? []).filter((id) => granted.includes(id));
    const candidates = [...preferred, ...granted.filter((id) => !preferred.includes(id))];
    const nodeFor = (thread: number) => grant.numaNodeByThread?.[thread] ?? profile.numaTopology.find((node) => node.threadIds.includes(thread))?.nodeId ?? 0;
    const ordered = preference.strategy === 'spread' ? candidates.sort((a, b) => nodeFor(a) - nodeFor(b) || a - b) : preference.strategy === 'numa-local' && preference.preferredNumaNodes?.length ? candidates.sort((a, b) => { const locality = Number(!preference.preferredNumaNodes!.includes(nodeFor(a))) - Number(!preference.preferredNumaNodes!.includes(nodeFor(b))); return locality || a - b; }) : candidates;
    const coreIds = grant.grantedCoreIds?.length ? [...grant.grantedCoreIds] : ordered.map((thread) => thread % Math.max(profile.coreCount, 1));
    const smtUsed = new Set(coreIds).size < ordered.length;
    return { reservationId: grant.reservationId, threadIds: [...ordered], coreIds: [...coreIds], numaNodes: [...new Set(ordered.map(nodeFor))].sort((a, b) => a - b), smtUsed, strategy: preference.strategy };
  }
}
