import { describe, expect, it, afterEach } from 'vitest';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  createJsonDomainHandler,
  createNoopDomainHandler,
  createDataAuthorityHandler,
} from '../src/handlers.js';
import { DataAuthority } from '../../data_authority/src/index.js';
import { makeTempRoot, cleanupTempRoot } from './testHelpers.js';

describe('Domain backup handlers (§5/Law 1 — real orchestration, not reimplementation)', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('createJsonDomainHandler backs up real, gzip-compressed, checksummed data', async () => {
    root = makeTempRoot();
    const handler = createJsonDomainHandler('test-domain', () => ({ hello: 'world' }));
    const result = await handler.backup(root);

    expect(result.compressionStatus).toBe('gzip');
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(existsSync(result.location)).toBe(true);

    const validation = await handler.validate(result);
    expect(validation.valid).toBe(true);
  });

  it('createJsonDomainHandler detects a corrupted backup via checksum mismatch', async () => {
    root = makeTempRoot();
    const handler = createJsonDomainHandler('test-domain', () => ({ hello: 'world' }));
    const result = await handler.backup(root);
    writeFileSync(result.location, Buffer.from('corrupted'));

    const validation = await handler.validate(result);
    expect(validation.valid).toBe(false);
    expect(validation.reasons[0]).toMatch(/checksum mismatch/i);
  });

  it('createJsonDomainHandler restores real data via a supplied restoreFn', async () => {
    root = makeTempRoot();
    let restored: unknown;
    const handler = createJsonDomainHandler(
      'test-domain',
      () => ({ hello: 'world' }),
      (data) => {
        restored = data;
      },
    );
    const result = await handler.backup(root);
    const restoreResult = await handler.restore(result);

    expect(restoreResult.success).toBe(true);
    expect(restoreResult.supported).toBe(true);
    expect(restored).toEqual({ hello: 'world' });
  });

  it('createJsonDomainHandler without a restoreFn honestly reports unsupported, not a failure', async () => {
    root = makeTempRoot();
    const handler = createJsonDomainHandler('hardware-registry', () => ({ inventory: [] }));
    const result = await handler.backup(root);
    const restoreResult = await handler.restore(result);

    expect(restoreResult.supported).toBe(false);
    expect(restoreResult.message).toMatch(/does not support restore/i);
  });

  it('createNoopDomainHandler produces an honest, zero-byte result — not fabricated data', async () => {
    const handler = createNoopDomainHandler('plugin-registry');
    const result = await handler.backup('/unused');
    expect(result.sizeBytes).toBe(0);

    const validation = await handler.validate(result);
    expect(validation.valid).toBe(true);

    const restoreResult = await handler.restore(result);
    expect(restoreResult.supported).toBe(false);
  });

  it('createDataAuthorityHandler wraps IDA\'s real backup()/validateBackup()/restore() — a genuine round-trip', async () => {
    root = makeTempRoot();
    const ida = new DataAuthority();
    ida.registerDomainSchema({ domain: 'benchmark-results', version: 1, fields: [{ name: 'name', type: 'string', required: true }] });
    ida.create('benchmark-results', { name: 'gpu-1' }, 'X');

    const handler = createDataAuthorityHandler(ida);
    const result = await handler.backup(join(root, 'db-backup'));
    expect(existsSync(result.location)).toBe(true);

    const validation = await handler.validate(result);
    expect(validation.valid).toBe(true);

    // Real restore round-trip: create a second, empty IDA and restore into it.
    const restoreTarget = new DataAuthority();
    restoreTarget.registerDomainSchema({ domain: 'benchmark-results', version: 1, fields: [{ name: 'name', type: 'string', required: true }] });
    const restoreHandler = createDataAuthorityHandler(restoreTarget);
    const restoreResult = await restoreHandler.restore(result);
    expect(restoreResult.success).toBe(true);
    expect(restoreTarget.find('benchmark-results', {}).some((r) => r.data.name === 'gpu-1')).toBe(true);

    ida.close();
    restoreTarget.close();
  });
});
