import { describe, expect, it } from 'vitest';
import { ArtifactCompatibilityRegistry } from '../src/artifactCompatibilityRegistry.js';

describe('ArtifactCompatibilityRegistry (§7 — distinct from ICMS\'s CompatibilityRegistry)', () => {
  it('records and checks a real compatibility relationship', () => {
    const registry = new ArtifactCompatibilityRegistry();
    registry.record('database-schema', '1.0.0', 'database-schema', '2.0.0', true, 'additive change');
    const found = registry.check('database-schema', '1.0.0', 'database-schema', '2.0.0');
    expect(found?.compatible).toBe(true);
  });

  it('check() returns undefined for an unrecorded relationship — never assumed', () => {
    const registry = new ArtifactCompatibilityRegistry();
    expect(registry.check('database-schema', '1.0.0', 'database-schema', '9.0.0')).toBeUndefined();
  });

  it('check() returns the most recently recorded relationship for the same pair', () => {
    const registry = new ArtifactCompatibilityRegistry();
    registry.record('database-schema', '1.0.0', 'database-schema', '2.0.0', false, 'initial finding');
    registry.record('database-schema', '1.0.0', 'database-schema', '2.0.0', true, 're-evaluated');
    expect(registry.check('database-schema', '1.0.0', 'database-schema', '2.0.0')?.compatible).toBe(true);
  });

  it('relationshipsFrom() and relationshipsTo() filter correctly', () => {
    const registry = new ArtifactCompatibilityRegistry();
    registry.record('plugin-manifest', '1.0.0', 'runtime-contract', '3.0.0', true);
    expect(registry.relationshipsFrom('plugin-manifest', '1.0.0')).toHaveLength(1);
    expect(registry.relationshipsTo('runtime-contract', '3.0.0')).toHaveLength(1);
    expect(registry.relationshipsFrom('plugin-manifest', '2.0.0')).toHaveLength(0);
  });
});
