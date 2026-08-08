import { describe, expect, it } from 'vitest';
import { ConfigurationAuthority } from '../src/ConfigurationAuthority.js';
import { CURRENT_SCHEMA_VERSION } from '../src/registry.js';

describe('VersionInfo (§14)', () => {
  it('reports schema, runtime, compatibility, and migration versions', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();

    const info = authority.getVersionInfo();
    expect(info.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(info.runtimeVersion).toBe('0.1.0');
    expect(info.compatibilityVersion).toBe('1.0.0');
    expect(info.migrationVersion).toBe('none');
  });

  it('an explicit schemaVersion option overrides the default', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {}, schemaVersion: '3.0.0' });
    authority.load();
    expect(authority.getVersionInfo().schemaVersion).toBe('3.0.0');
  });
});
