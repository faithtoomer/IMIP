import { describe, expect, it, afterEach } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigurationAuthority } from '../src/ConfigurationAuthority.js';
import { StorageAuthority } from '../../storage_authority/src/index.js';

describe('ConfigurationAuthority + StorageAuthority integration (ADR-0012 — Law 3)', () => {
  let root: string;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('with no storageAuthority given, ICMS keeps its original default: no config file source', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    expect(() => authority.load()).not.toThrow();
  });

  it('with a storageAuthority given and no explicit filePath, ICMS allocates a real config file location via ISMA', () => {
    root = mkdtempSync(join(tmpdir(), 'imip-icms-isma-'));
    const isma = new StorageAuthority({ rootPath: root });
    new ConfigurationAuthority({ argv: [], env: {}, storageAuthority: isma });

    const entry = isma.registry.findByPurpose('configuration', 'icms-config');
    expect(entry).toBeDefined();
    expect(entry!.path.endsWith('config.json')).toBe(true);
  });

  it('a value present in the ISMA-allocated config file is actually loaded', () => {
    root = mkdtempSync(join(tmpdir(), 'imip-icms-isma-value-'));
    const isma = new StorageAuthority({ rootPath: root });
    const configPath = isma.allocate('configuration', 'icms-config', { filename: 'config.json' }).path;
    writeFileSync(configPath, JSON.stringify({ 'platform.locale': 'fr-FR' }));

    const authority = new ConfigurationAuthority({ argv: [], env: {}, storageAuthority: isma });
    const snapshot = authority.load();
    expect(snapshot.values['platform.locale']).toBe('fr-FR');
  });

  it('an explicit filePath always overrides storageAuthority', () => {
    root = mkdtempSync(join(tmpdir(), 'imip-icms-isma-override-'));
    const isma = new StorageAuthority({ rootPath: root });
    const explicitPath = join(root, 'explicit-config.json');
    writeFileSync(explicitPath, JSON.stringify({ 'platform.locale': 'de-DE' }));

    const authority = new ConfigurationAuthority({ argv: [], env: {}, storageAuthority: isma, filePath: explicitPath });
    const snapshot = authority.load();

    expect(snapshot.values['platform.locale']).toBe('de-DE');
    expect(isma.registry.findByPurpose('configuration', 'icms-config')).toBeUndefined();
  });

  it('the allocated config directory actually exists on disk', () => {
    root = mkdtempSync(join(tmpdir(), 'imip-icms-isma-dir-'));
    const isma = new StorageAuthority({ rootPath: root });
    new ConfigurationAuthority({ argv: [], env: {}, storageAuthority: isma });

    const entry = isma.registry.findByPurpose('configuration', 'icms-config')!;
    expect(existsSync(join(entry.path, '..'))).toBe(true);
  });
});
