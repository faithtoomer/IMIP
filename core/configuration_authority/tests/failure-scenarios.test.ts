import { describe, expect, it } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigurationAuthority } from '../src/ConfigurationAuthority.js';
import { ConfigurationError, ConfigurationValidationError, ConfigurationRollbackError } from '../src/errors.js';

describe('failure handling (§18 — fail fast, no silent fallbacks)', () => {
  it('throws a structured ConfigurationValidationError on invalid startup config with no prior valid snapshot', () => {
    const filePath = join(tmpdir(), `imip-invalid-${Date.now()}.json`);
    writeFileSync(filePath, JSON.stringify({ 'platform.logLevel': 'not-a-real-level' }));

    try {
      const authority = new ConfigurationAuthority({ argv: [], env: {}, filePath });
      expect(() => authority.load()).toThrow(ConfigurationValidationError);
      try {
        authority.load();
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        expect((error as ConfigurationValidationError).errors.length).toBeGreaterThan(0);
      }
    } finally {
      unlinkSync(filePath);
    }
  });

  it('throws on a malformed (unparsable) config file with no prior valid snapshot', () => {
    const filePath = join(tmpdir(), `imip-syntax-${Date.now()}.json`);
    writeFileSync(filePath, '{ not valid json');

    try {
      const authority = new ConfigurationAuthority({ argv: [], env: {}, filePath });
      expect(() => authority.load()).toThrow(ConfigurationValidationError);
    } finally {
      unlinkSync(filePath);
    }
  });

  it('preserves the last known valid configuration when a reload becomes invalid', () => {
    const filePath = join(tmpdir(), `imip-reload-${Date.now()}.json`);
    writeFileSync(filePath, JSON.stringify({ 'platform.locale': 'fr-FR' }));

    try {
      const authority = new ConfigurationAuthority({ argv: [], env: {}, filePath });
      const first = authority.load();
      expect(first.values['platform.locale']).toBe('fr-FR');

      writeFileSync(filePath, JSON.stringify({ 'platform.logLevel': 'not-a-real-level' }));
      const second = authority.reload();

      expect(second.version).toBe(first.version);
      expect(second.values['platform.locale']).toBe('fr-FR');
    } finally {
      unlinkSync(filePath);
    }
  });

  it('getSnapshot() throws before load() has ever been called', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    expect(() => authority.getSnapshot()).toThrow(ConfigurationError);
  });

  it('requestUpdate() rejects an immutable key', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();
    expect(() => authority.requestUpdate('platform.name', 'Renamed', 'attempted rename', 'Dashboard')).toThrow(
      /immutable/i,
    );
  });

  it('requestUpdate() rejects an unregistered key', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();
    expect(() => authority.requestUpdate('not.a.real.key', 1, 'test', 'Dashboard')).toThrow(/Unknown configuration key/);
  });

  it('rollback() to a nonexistent version throws ConfigurationRollbackError', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();
    expect(() => authority.rollback(999, 'test', 'Dashboard')).toThrow(ConfigurationRollbackError);
  });
});
