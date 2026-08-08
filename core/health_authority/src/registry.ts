import { HealthProfileNotFoundError } from './errors.js';
import type { HealthComponentType, HealthProfile } from './types.js';

/** §4 — generic registry; it stores no hardware-specific or resource-specific logic. */
export class HealthRegistry {
  private profiles = new Map<string, HealthProfile>();

  static keyFor(componentType: HealthComponentType, componentId: string, providerSource: string): string {
    return JSON.stringify([componentType, componentId, providerSource]);
  }

  upsert(profile: HealthProfile): void {
    this.profiles.set(HealthRegistry.keyFor(profile.componentType, profile.componentId, profile.providerSource), profile);
  }

  remove(componentType: HealthComponentType, componentId: string, providerSource: string): boolean {
    return this.profiles.delete(HealthRegistry.keyFor(componentType, componentId, providerSource));
  }

  get(componentType: HealthComponentType, componentId: string, providerSource: string): HealthProfile | undefined {
    return this.profiles.get(HealthRegistry.keyFor(componentType, componentId, providerSource));
  }

  require(componentType: HealthComponentType, componentId: string, providerSource: string): HealthProfile {
    const key = HealthRegistry.keyFor(componentType, componentId, providerSource);
    const profile = this.profiles.get(key);
    if (!profile) throw new HealthProfileNotFoundError(key);
    return profile;
  }

  all(): HealthProfile[] {
    return [...this.profiles.values()].sort((a, b) => HealthRegistry.keyFor(a.componentType, a.componentId, a.providerSource)
      .localeCompare(HealthRegistry.keyFor(b.componentType, b.componentId, b.providerSource)));
  }

  byComponent(componentType: HealthComponentType, componentId: string): HealthProfile[] {
    return this.all().filter((profile) => profile.componentType === componentType && profile.componentId === componentId);
  }

  byType(componentType: HealthComponentType): HealthProfile[] {
    return this.all().filter((profile) => profile.componentType === componentType);
  }

  byProvider(providerSource: string): HealthProfile[] {
    return this.all().filter((profile) => profile.providerSource === providerSource);
  }

  ids(): string[] {
    return this.all().map((profile) => profile.profileId);
  }
}
