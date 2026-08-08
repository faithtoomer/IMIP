import { describe, expect, it, afterEach } from 'vitest';
import { StorageAuthority } from '../src/StorageAuthority.js';
import { makeTempRoot, cleanupTempRoot } from './testHelpers.js';

describe('performance smoke tests', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('allocates 100 distinct storage locations well under 1s', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    const start = performance.now();
    for (let i = 0; i < 100; i += 1) {
      isma.allocate('telemetry', `purpose-${i}`);
    }
    expect(performance.now() - start).toBeLessThan(1000);
    expect(isma.getMetrics().allocationCount).toBe(100);
  });
});
