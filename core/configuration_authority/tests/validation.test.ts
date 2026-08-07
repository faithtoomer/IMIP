import { describe, expect, it } from 'vitest';
import { ConfigurationRegistry, DEFAULT_ENTRIES } from '../src/registry.js';
import { validateAll } from '../src/validate.js';

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

describe('validateAll', () => {
  it('accepts the full set of registry defaults', () => {
    const registry = freshRegistry();
    const result = validateAll(registry, defaults(registry));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a type mismatch', () => {
    const registry = freshRegistry();
    const values = { ...defaults(registry), 'platform.debugMode': 'not-a-boolean' };
    const result = validateAll(registry, values);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === 'platform.debugMode')).toBe(true);
  });

  it('rejects an enum violation', () => {
    const registry = freshRegistry();
    const values = { ...defaults(registry), 'platform.logLevel': 'trace' };
    const result = validateAll(registry, values);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === 'platform.logLevel')).toBe(true);
  });

  it('rejects a range violation', () => {
    const registry = freshRegistry();
    const values = { ...defaults(registry), 'ai.recommendationConfidenceThreshold': 1.5 };
    const result = validateAll(registry, values);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === 'ai.recommendationConfidenceThreshold')).toBe(true);
  });

  it('rejects an unregistered key (SSOT enforcement)', () => {
    const registry = freshRegistry();
    const values = { ...defaults(registry), 'mining.profitThreshold': 0.05 };
    const result = validateAll(registry, values);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === 'mining.profitThreshold')).toBe(true);
  });

  it('rejects a missing required value with no usable default', () => {
    const registry = freshRegistry();
    const values = defaults(registry);
    delete values['platform.name'];
    (values as Record<string, unknown>)['platform.name'] = undefined;
    const result = validateAll(registry, values);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === 'platform.name')).toBe(true);
  });

  it('applies cross-field validation (off-peak must not exceed peak under time-of-use)', () => {
    const registry = freshRegistry();
    const values = {
      ...defaults(registry),
      'electricity.billingModel': 'time-of-use',
      'electricity.peakPricing': 0.1,
      'electricity.offPeakPricing': 0.2,
    };
    const result = validateAll(registry, values);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === 'electricity.offPeakPricing')).toBe(true);
  });

  it('applies dependency validation (learningMode requires ai.enabled)', () => {
    const registry = freshRegistry();
    const values = { ...defaults(registry), 'ai.enabled': false, 'ai.learningMode': 'online' };
    const result = validateAll(registry, values);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === 'ai.learningMode')).toBe(true);
  });
});
