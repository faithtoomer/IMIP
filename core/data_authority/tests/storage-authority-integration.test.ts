import { describe, expect, it, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataAuthority } from '../src/DataAuthority.js';
import { StorageAuthority } from '../../storage_authority/src/index.js';
import { WIDGET_SCHEMA } from './testHelpers.js';

describe('DataAuthority + StorageAuthority integration (ADR-0012 — Law 3)', () => {
  let root: string;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('with no storageAuthority given, IDA keeps its original default: in-memory', () => {
    const ida = new DataAuthority();
    ida.registerDomainSchema(WIDGET_SCHEMA);
    ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
    expect(ida.getMetrics().storageBytes).toBe(0); // in-memory has no on-disk size
    ida.close();
  });

  it('with a storageAuthority given and no explicit filePath, IDA allocates a real on-disk database via ISMA', () => {
    root = mkdtempSync(join(tmpdir(), 'imip-ida-isma-'));
    const isma = new StorageAuthority({ rootPath: root });
    const ida = new DataAuthority({ storageAuthority: isma });
    ida.registerDomainSchema(WIDGET_SCHEMA);
    ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');

    const entry = isma.registry.findByPurpose('database', 'ida-primary');
    expect(entry).toBeDefined();
    expect(existsSync(entry!.path)).toBe(true);
    ida.close();
  });

  it('an explicit filePath always overrides storageAuthority', () => {
    root = mkdtempSync(join(tmpdir(), 'imip-ida-isma-override-'));
    const isma = new StorageAuthority({ rootPath: root });
    const explicitPath = join(root, 'explicit.db');
    const ida = new DataAuthority({ storageAuthority: isma, filePath: explicitPath });
    ida.registerDomainSchema(WIDGET_SCHEMA);
    ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');

    expect(existsSync(explicitPath)).toBe(true);
    expect(isma.registry.findByPurpose('database', 'ida-primary')).toBeUndefined();
    ida.close();
  });

  it('re-opening a second DataAuthority against the same StorageAuthority reuses the same allocated path', () => {
    root = mkdtempSync(join(tmpdir(), 'imip-ida-isma-shared-'));
    const isma = new StorageAuthority({ rootPath: root });
    const first = new DataAuthority({ storageAuthority: isma });
    const firstPath = isma.registry.findByPurpose('database', 'ida-primary')!.path;
    first.close();

    const second = new DataAuthority({ storageAuthority: isma });
    const secondPath = isma.registry.findByPurpose('database', 'ida-primary')!.path;
    expect(secondPath).toBe(firstPath);
    second.close();
  });
});
