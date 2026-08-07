import { describe, expect, it } from 'vitest';
import { ConfigurationRegistry, DEFAULT_ENTRIES } from '../src/registry.js';
import { registerPluginSchema, validatePluginConfig } from '../src/pluginConfig.js';
import type { ConfigEntry } from '../src/types.js';

function freshRegistry() {
  const registry = new ConfigurationRegistry();
  registry.registerAll(DEFAULT_ENTRIES);
  return registry;
}

function moneroEntry(overrides: Partial<ConfigEntry> = {}): ConfigEntry {
  return {
    id: 'plugins.monero.threads',
    category: 'plugins',
    description: 'RandomX thread count',
    dataType: 'number',
    defaultValue: 1,
    range: { min: 1 },
    owner: 'monero',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
    ...overrides,
  };
}

describe('plugin configuration integration (§13)', () => {
  it('registers a plugin schema namespaced under plugins.<id>.*', () => {
    const registry = freshRegistry();
    registerPluginSchema(registry, { pluginId: 'monero', entries: [moneroEntry()] });
    expect(registry.get('plugins.monero.threads')).toBeDefined();
  });

  it('rejects a plugin entry outside its own namespace', () => {
    const registry = freshRegistry();
    expect(() =>
      registerPluginSchema(registry, {
        pluginId: 'monero',
        entries: [moneroEntry({ id: 'plugins.flux.threads' })],
      }),
    ).toThrow(/may only declare keys under/);
  });

  it('rejects a plugin entry that does not declare itself as owner', () => {
    const registry = freshRegistry();
    expect(() =>
      registerPluginSchema(registry, {
        pluginId: 'monero',
        entries: [moneroEntry({ owner: 'someone-else' })],
      }),
    ).toThrow(/must declare owner/);
  });

  it('validates plugin configuration in isolation from the rest of the registry', () => {
    const registry = freshRegistry();
    registerPluginSchema(registry, { pluginId: 'monero', entries: [moneroEntry()] });

    const valid = validatePluginConfig(registry, 'monero', { 'plugins.monero.threads': 4 });
    expect(valid.valid).toBe(true);

    const invalid = validatePluginConfig(registry, 'monero', { 'plugins.monero.threads': 0 });
    expect(invalid.valid).toBe(false);
  });
});
