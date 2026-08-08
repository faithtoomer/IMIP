import type { ResourceProfile, ResourceState, ResourceType } from './types.js';
import { ResourceNotFoundError } from './errors.js';

/**
 * §6 — Resource Registry. Sole authoritative store of resource profiles,
 * keyed by resourceId.
 */
export class ResourceRegistry {
  private resources = new Map<string, ResourceProfile>();

  upsert(profile: ResourceProfile): void {
    this.resources.set(profile.resourceId, profile);
  }

  remove(resourceId: string): boolean {
    return this.resources.delete(resourceId);
  }

  get(resourceId: string): ResourceProfile | undefined {
    return this.resources.get(resourceId);
  }

  require(resourceId: string): ResourceProfile {
    const profile = this.resources.get(resourceId);
    if (!profile) throw new ResourceNotFoundError(resourceId);
    return profile;
  }

  all(): ResourceProfile[] {
    return [...this.resources.values()].sort((a, b) => a.resourceId.localeCompare(b.resourceId));
  }

  ids(): string[] {
    return [...this.resources.keys()].sort();
  }

  byType(resourceType: ResourceType): ResourceProfile[] {
    return this.all().filter((profile) => profile.resourceType === resourceType);
  }

  byState(state: ResourceState): ResourceProfile[] {
    return this.all().filter((profile) => profile.state === state);
  }

  byHardwareId(hardwareId: string): ResourceProfile[] {
    return this.all().filter((profile) => profile.hardwareId === hardwareId);
  }

  byCapability(capabilityRef: string): ResourceProfile[] {
    return this.all().filter((profile) => profile.capabilityRefs.includes(capabilityRef));
  }
}
