import { DEFAULT_ARTIFACT_TYPES } from './types.js';

/** §6/Law 2 — a real, runtime-extensible registry, matching the category-
 * registry pattern used throughout Program II (IOLA, INCA, IBRRA). */
export class ArtifactTypeRegistry {
  private types = new Set<string>(DEFAULT_ARTIFACT_TYPES);

  register(artifactType: string): void {
    this.types.add(artifactType);
  }

  has(artifactType: string): boolean {
    return this.types.has(artifactType);
  }

  all(): string[] {
    return [...this.types];
  }
}
