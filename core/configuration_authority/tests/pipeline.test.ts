import { describe, expect, it } from 'vitest';
import { ConfigurationRegistry, DEFAULT_ENTRIES } from '../src/registry.js';
import { runValidationPipeline } from '../src/pipeline.js';
import { CompatibilityRegistry } from '../src/compatibility.js';

function freshRegistry() {
  const registry = new ConfigurationRegistry();
  registry.registerAll(DEFAULT_ENTRIES);
  return registry;
}

function defaults(registry: ConfigurationRegistry) {
  const values: Record<string, unknown> = {};
  for (const entry of registry.all()) values[entry.id] = entry.defaultValue;
  return values;
}

function compat() {
  return { hardware: new CompatibilityRegistry(), policy: new CompatibilityRegistry() };
}

describe('nine-stage validation pipeline (§10)', () => {
  it('accepts the full set of registry defaults across all nine stages', () => {
    const registry = freshRegistry();
    const result = runValidationPipeline(registry, defaults(registry), compat());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.stages.map((s) => s.name)).toEqual([
      'syntax',
      'schema',
      'type',
      'range',
      'cross-field',
      'authority-compatibility',
      'plugin-compatibility',
      'hardware-compatibility',
      'policy-compatibility',
    ]);
  });

  it('stage 1 (syntax) short-circuits the remaining stages', () => {
    const registry = freshRegistry();
    const result = runValidationPipeline(registry, {}, compat(), {
      syntaxError: { id: '__syntax__', message: 'malformed source' },
    });
    expect(result.valid).toBe(false);
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0].name).toBe('syntax');
  });

  it('stage 2 (schema) rejects an unregistered key', () => {
    const registry = freshRegistry();
    const values = { ...defaults(registry), 'mining.profitThreshold': 0.05 };
    const result = runValidationPipeline(registry, values, compat());
    expect(result.valid).toBe(false);
    const schemaStage = result.stages.find((s) => s.name === 'schema');
    expect(schemaStage?.errors.some((e) => e.id === 'mining.profitThreshold')).toBe(true);
  });

  it('stage 3 (type) rejects a type mismatch', () => {
    const registry = freshRegistry();
    const values = { ...defaults(registry), 'platform.debugMode': 'not-a-boolean' };
    const result = runValidationPipeline(registry, values, compat());
    const typeStage = result.stages.find((s) => s.name === 'type');
    expect(typeStage?.errors.some((e) => e.id === 'platform.debugMode')).toBe(true);
  });

  it('stage 3 (type) rejects an enum violation', () => {
    const registry = freshRegistry();
    const values = { ...defaults(registry), 'platform.logLevel': 'trace' };
    const result = runValidationPipeline(registry, values, compat());
    const typeStage = result.stages.find((s) => s.name === 'type');
    expect(typeStage?.errors.some((e) => e.id === 'platform.logLevel')).toBe(true);
  });

  it('stage 4 (range) rejects an out-of-range number', () => {
    const registry = freshRegistry();
    const values = { ...defaults(registry), 'ai.recommendationConfidenceThreshold': 1.5 };
    const result = runValidationPipeline(registry, values, compat());
    const rangeStage = result.stages.find((s) => s.name === 'range');
    expect(rangeStage?.errors.some((e) => e.id === 'ai.recommendationConfidenceThreshold')).toBe(true);
  });

  it('stage 5 (cross-field) applies cross-field and dependency validation', () => {
    const registry = freshRegistry();
    const values = {
      ...defaults(registry),
      'electricity.billingModel': 'time-of-use',
      'electricity.peakPricing': 0.1,
      'electricity.offPeakPricing': 0.2,
    };
    const result = runValidationPipeline(registry, values, compat());
    const crossFieldStage = result.stages.find((s) => s.name === 'cross-field');
    expect(crossFieldStage?.errors.some((e) => e.id === 'electricity.offPeakPricing')).toBe(true);
  });

  it('stage 6 (authority compatibility) rejects an unrecognized owner', () => {
    const registry = freshRegistry();
    registry.register({
      id: 'mining.rogue',
      category: 'mining',
      description: 'rogue entry',
      dataType: 'boolean',
      defaultValue: false,
      owner: 'Some Rogue Owner',
      runtimeMutability: 'hot-reloadable',
      versionIntroduced: '1.0.0',
      securityClassification: 'public',
    });
    const result = runValidationPipeline(registry, defaults(registry), compat());
    const stage = result.stages.find((s) => s.name === 'authority-compatibility');
    expect(stage?.errors.some((e) => e.id === 'mining.rogue')).toBe(true);
  });

  it('stage 7 (plugin compatibility) rejects a mis-namespaced plugin entry', () => {
    const registry = freshRegistry();
    registry.register({
      id: 'plugins.flux.threads',
      category: 'plugins',
      description: 'bad namespace',
      dataType: 'number',
      defaultValue: 1,
      owner: 'monero',
      runtimeMutability: 'hot-reloadable',
      versionIntroduced: '1.0.0',
      securityClassification: 'public',
    });
    const result = runValidationPipeline(registry, defaults(registry), compat());
    const stage = result.stages.find((s) => s.name === 'plugin-compatibility');
    expect(stage?.errors.some((e) => e.id === 'plugins.flux.threads')).toBe(true);
  });

  it('stage 8 (hardware compatibility) is a real, functioning extension point', () => {
    const registry = freshRegistry();
    const compatibility = compat();
    compatibility.hardware.register((id, value) =>
      id === 'hardware.reservedCpuCores' && Array.isArray(value) && value.length > 64
        ? `"${id}" exceeds detected CPU core count.`
        : null,
    );
    const values = { ...defaults(registry), 'hardware.reservedCpuCores': Array.from({ length: 100 }, (_, i) => i) };
    const result = runValidationPipeline(registry, values, compatibility);
    const stage = result.stages.find((s) => s.name === 'hardware-compatibility');
    expect(stage?.errors.some((e) => e.id === 'hardware.reservedCpuCores')).toBe(true);
  });

  it('stage 8/9 pass cleanly with zero registered checkers (no Hardware/Policy Authority yet)', () => {
    const registry = freshRegistry();
    const result = runValidationPipeline(registry, defaults(registry), compat());
    expect(result.stages.find((s) => s.name === 'hardware-compatibility')?.errors).toEqual([]);
    expect(result.stages.find((s) => s.name === 'policy-compatibility')?.errors).toEqual([]);
  });

  it('stage 9 (policy compatibility) is a real, functioning extension point', () => {
    const registry = freshRegistry();
    const compatibility = compat();
    compatibility.policy.register((id, value) =>
      id === 'mining.enabled' && value === true ? 'Policy: mining not currently permitted.' : null,
    );
    const values = { ...defaults(registry), 'mining.enabled': true };
    const result = runValidationPipeline(registry, values, compatibility);
    const stage = result.stages.find((s) => s.name === 'policy-compatibility');
    expect(stage?.errors.some((e) => e.id === 'mining.enabled')).toBe(true);
  });
});
