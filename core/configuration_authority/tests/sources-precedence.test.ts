import { describe, expect, it } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigurationRegistry, DEFAULT_ENTRIES } from '../src/registry.js';
import { resolveConfigValues, type SecretsProvider } from '../src/sources.js';
import { ConfigurationSyntaxError } from '../src/errors.js';

describe('source precedence (cli > env > secrets > file > default)', () => {
  function freshRegistry() {
    const registry = new ConfigurationRegistry();
    registry.registerAll(DEFAULT_ENTRIES);
    return registry;
  }

  it('falls back to the registry default when no source provides a value', () => {
    const registry = freshRegistry();
    const { values } = resolveConfigValues(registry, { argv: [], env: {} });
    expect(values['platform.locale']).toBe('en-US');
  });

  it('a config file value overrides the default', () => {
    const registry = freshRegistry();
    const filePath = join(tmpdir(), `imip-config-${Date.now()}.json`);
    writeFileSync(filePath, JSON.stringify({ 'platform.locale': 'fr-FR' }));
    try {
      const { values } = resolveConfigValues(registry, { argv: [], env: {}, filePath });
      expect(values['platform.locale']).toBe('fr-FR');
    } finally {
      unlinkSync(filePath);
    }
  });

  it('the secrets store overrides the config file (new precedence order)', () => {
    const registry = freshRegistry();
    const filePath = join(tmpdir(), `imip-config-${Date.now()}-secrets.json`);
    writeFileSync(filePath, JSON.stringify({ 'wallet.addresses': [{ coin: 'XMR', address: 'from-file' }] }));
    const provider: SecretsProvider = {
      get: (id) => (id === 'wallet.addresses' ? [{ coin: 'XMR', address: 'from-secrets' }] : undefined),
    };
    try {
      const { values } = resolveConfigValues(registry, { argv: [], env: {}, filePath, secretsProvider: provider });
      expect(values['wallet.addresses']).toEqual([{ coin: 'XMR', address: 'from-secrets' }]);
    } finally {
      unlinkSync(filePath);
    }
  });

  it('an env var overrides the secrets store', () => {
    const registry = freshRegistry();
    const provider: SecretsProvider = {
      get: (id) => (id === 'wallet.addresses' ? [{ coin: 'XMR', address: 'from-secrets' }] : undefined),
    };
    const { values } = resolveConfigValues(registry, {
      argv: [],
      env: { IMIP_WALLET_ADDRESSES: '[]' },
      secretsProvider: provider,
    });
    expect(values['wallet.addresses']).toEqual([]);
  });

  it('a CLI argument overrides everything else', () => {
    const registry = freshRegistry();
    const { values } = resolveConfigValues(registry, {
      argv: ['--platform.locale=es-ES'],
      env: { IMIP_PLATFORM_LOCALE: 'de-DE' },
    });
    expect(values['platform.locale']).toBe('es-ES');
  });

  it('the secrets store only fills non-public/internal keys', () => {
    const registry = freshRegistry();
    const provider: SecretsProvider = {
      get: (id) => (id === 'platform.locale' ? 'should-not-apply' : undefined),
    };
    const { values } = resolveConfigValues(registry, { argv: [], env: {}, secretsProvider: provider });
    expect(values['platform.locale']).toBe('en-US');
  });

  it('resolution records the winning source per key', () => {
    const registry = freshRegistry();
    const { resolution } = resolveConfigValues(registry, {
      argv: ['--platform.locale=es-ES'],
      env: {},
    });
    const localeResolution = resolution.find((r) => r.id === 'platform.locale');
    expect(localeResolution?.source).toBe('cli');
  });

  it('a malformed config file raises a ConfigurationSyntaxError (stage 1)', () => {
    const registry = freshRegistry();
    const filePath = join(tmpdir(), `imip-bad-${Date.now()}.json`);
    writeFileSync(filePath, '{ not valid json');
    try {
      expect(() => resolveConfigValues(registry, { argv: [], env: {}, filePath })).toThrow(ConfigurationSyntaxError);
    } finally {
      unlinkSync(filePath);
    }
  });
});
