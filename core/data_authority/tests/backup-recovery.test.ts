import { describe, expect, it } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DataAuthority } from '../src/DataAuthority.js';
import { WIDGET_SCHEMA } from './testHelpers.js';

function makeAuthority(): DataAuthority {
  const ida = new DataAuthority();
  ida.registerDomainSchema(WIDGET_SCHEMA);
  return ida;
}

describe('DataAuthority backup & recovery (§14)', () => {
  it('backup() produces a real file and reports its size', () => {
    const ida = makeAuthority();
    ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
    const path = join(tmpdir(), `imip-ida-backup-${Date.now()}.db`);

    try {
      const result = ida.backup(path);
      expect(existsSync(path)).toBe(true);
      expect(result.sizeBytes).toBeGreaterThanOrEqual(0);
      expect(ida.validateBackup(path).valid).toBe(true);
    } finally {
      ida.close();
      if (existsSync(path)) unlinkSync(path);
    }
  });

  it('createRecoveryCheckpoint() is a real backup usable for restore', () => {
    const ida = makeAuthority();
    ida.create('benchmark-results', { name: 'checkpoint-test', value: 42 }, 'X');
    const path = join(tmpdir(), `imip-ida-checkpoint-${Date.now()}.db`);

    try {
      ida.createRecoveryCheckpoint(path);
      const check = new DataAuthority({ filePath: path });
      check.registerDomainSchema(WIDGET_SCHEMA);
      expect(check.find('benchmark-results', {}).some((r) => r.data.name === 'checkpoint-test')).toBe(true);
      check.close();
    } finally {
      ida.close();
      if (existsSync(path)) unlinkSync(path);
    }
  });

  it('restore() replaces live storage with a backup\'s contents', () => {
    const ida = makeAuthority();
    ida.create('benchmark-results', { name: 'before-backup', value: 1 }, 'X');
    const path = join(tmpdir(), `imip-ida-restore-${Date.now()}.db`);

    try {
      ida.backup(path);
      ida.create('benchmark-results', { name: 'after-backup', value: 2 }, 'X'); // not in the backup

      ida.restore(path);

      const names = ida.find('benchmark-results', {}).map((r) => r.data.name);
      expect(names).toContain('before-backup');
      expect(names).not.toContain('after-backup');
    } finally {
      ida.close();
      if (existsSync(path)) unlinkSync(path);
    }
  });

  it('restore() from an invalid path throws rather than silently proceeding', () => {
    const ida = makeAuthority();
    expect(() => ida.restore(join(tmpdir(), 'imip-ida-does-not-exist.db'))).toThrow();
    ida.close();
  });
});
