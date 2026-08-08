import type { ArbitrationRequest } from './types.js';

export interface ContentionGroup { resourceKey: string; requests: ArbitrationRequest[]; isContended: boolean; }
/** Groups pending requests without resolving a resource candidate or touching the Resource Registry. */
export function contestedResourceKey(request: ArbitrationRequest): string {
  return request.resourceId ?? `resource-type:${request.resourceType ?? 'unspecified'}`;
}
export function detectContention(requests: readonly ArbitrationRequest[]): ContentionGroup[] {
  const groups = new Map<string, ArbitrationRequest[]>();
  for (const request of requests) {
    const key = contestedResourceKey(request);
    groups.set(key, [...(groups.get(key) ?? []), { ...request, capabilityRefs: request.capabilityRefs ? [...request.capabilityRefs] : undefined }]);
  }
  return [...groups.entries()]
    .map(([resourceKey, grouped]) => ({ resourceKey, requests: grouped.sort((a, b) => a.requestId.localeCompare(b.requestId)), isContended: grouped.length > 1 }))
    .sort((a, b) => a.resourceKey.localeCompare(b.resourceKey));
}
