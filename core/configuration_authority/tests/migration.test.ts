import { describe, expect, it } from 'vitest';
import { ConfigurationRegistry, DEFAULT_ENTRIES } from '../src/registry.js';
import { validateEntries } from '../src/validate.js';
import type { ConfigEntry } from '../src/types.js';

describe('version migration fields (§5)', () => {
  it('every default entry declares the version it was introduced in', () => {
    const registry = new ConfigurationRegistry();
    registry.registerAll(DEFAULT_ENTRIES);
    for (const entry of registry.all()) {
      expect(entry.versionIntroduced).toBeTruthy();
    }
  });

  it('a deprecated entry remains registered and readable (backward compatible reads)', () => {
    const registry = new ConfigurationRegistry();
    const deprecated: ConfigEntry = {
      id: 'legacy.setting',
      category: 'platform',
      description: 'Superseded by platform.locale',
      dataType: 'string',
      defaultValue: 'en-US',
      owner: 'Configuration Authority',
      runtimeMutability: 'immutable',
      versionIntroduced: '0.9.0',
      versionDeprecated: '1.0.0',
      securityClassification: 'public',
    };
    registry.register(deprecated);

    const entry = registry.require('legacy.setting');
    expect(entry.versionDeprecated).toBe('1.0.0');

    const result = validateEntries([entry], { 'legacy.setting': 'en-US' });
    expect(result.valid).toBe(true);
  });
});
