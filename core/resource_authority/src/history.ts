import type { ResourceHistoryEntry } from './types.js';

export class ResourceHistoryStore {
  private entries: ResourceHistoryEntry[] = [];

  append(entry: ResourceHistoryEntry): ResourceHistoryEntry {
    const frozen = Object.freeze({ ...entry });
    this.entries.push(frozen);
    return frozen;
  }

  all(): readonly ResourceHistoryEntry[] {
    return this.entries;
  }

  forResource(resourceId: string): ResourceHistoryEntry[] {
    return this.entries.filter((e) => e.resourceId === resourceId);
  }

  byKind(kind: ResourceHistoryEntry['kind']): ResourceHistoryEntry[] {
    return this.entries.filter((e) => e.kind === kind);
  }
}
