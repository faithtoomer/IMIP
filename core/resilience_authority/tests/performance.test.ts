import { describe, expect, it, afterEach } from 'vitest';
import { ResilienceAuthority } from '../src/ResilienceAuthority.js';
import { createJsonDomainHandler } from '../src/handlers.js';
import { makeTempRoot, cleanupTempRoot } from './testHelpers.js';

describe('performance smoke tests', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('creates and verifies 25 small backups well under 2s', async () => {
    root = makeTempRoot();
    const ibrra = new ResilienceAuthority({ backupRootPath: root });
    ibrra.registerDomainHandler(createJsonDomainHandler('custom', () => ({ x: 1 })));

    const start = performance.now();
    for (let i = 0; i < 25; i += 1) {
      const record = await ibrra.createBackup({ backupType: 'manual', domains: ['custom'] });
      expect(record.status).toBe('available');
    }
    expect(performance.now() - start).toBeLessThan(2000);
    expect(ibrra.getMetrics().backupCount).toBe(25);
  });
});
