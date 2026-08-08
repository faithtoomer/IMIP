import type { ResourceProfile, ResourceState, ResourceType } from './types.js';
import type { ResourceMetrics } from './types.js';

export class MetricsCollector {
  collect(profiles: ResourceProfile[], collectedAt: string): ResourceMetrics {
    const byState = emptyStateCounts();
    const byType = emptyTypeCounts();

    let totalAllocatedCapacity = 0;
    let totalReservedCapacity = 0;
    let totalAvailableCapacity = 0;

    for (const profile of profiles) {
      byState[profile.state] += 1;
      byType[profile.resourceType] += 1;
      totalAllocatedCapacity += profile.utilizedCapacity;
      totalReservedCapacity += profile.reservedCapacity;
      totalAvailableCapacity += profile.availableCapacity;
    }

    return {
      totalResources: profiles.length,
      byState,
      byType,
      totalAllocatedCapacity,
      totalReservedCapacity,
      totalAvailableCapacity,
      collectedAt,
    };
  }
}

function emptyStateCounts(): Record<ResourceState, number> {
  return {
    discovered: 0,
    registered: 0,
    available: 0,
    reserved: 0,
    allocated: 0,
    active: 0,
    released: 0,
    unavailable: 0,
    retired: 0,
  };
}

function emptyTypeCounts(): Record<ResourceType, number> {
  return {
    cpu: 0,
    'cpu-core': 0,
    'cpu-pool': 0,
    gpu: 0,
    'gpu-memory': 0,
    'gpu-queue': 0,
    asic: 0,
    'asic-hashboard': 0,
    memory: 0,
    storage: 0,
    cloud: 0,
    'remote-worker': 0,
    'cluster-node': 0,
    fleet: 0,
  };
}
