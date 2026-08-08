import { describe, expect, it } from 'vitest';
import { ArtifactTypeRegistry } from '../src/artifactTypeRegistry.js';
import { DEFAULT_ARTIFACT_TYPES } from '../src/types.js';

describe('ArtifactTypeRegistry (§6/Law 2)', () => {
  it('pre-seeds every default artifact type', () => {
    const registry = new ArtifactTypeRegistry();
    for (const type of DEFAULT_ARTIFACT_TYPES) {
      expect(registry.has(type)).toBe(true);
    }
  });

  it('registers a new, future artifact type at runtime', () => {
    const registry = new ArtifactTypeRegistry();
    registry.register('ai-model');
    expect(registry.has('ai-model')).toBe(true);
  });

  it('has() is false for an unregistered type', () => {
    const registry = new ArtifactTypeRegistry();
    expect(registry.has('not-a-real-type')).toBe(false);
  });
});
