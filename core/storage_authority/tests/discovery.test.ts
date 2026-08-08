import { describe, expect, it } from 'vitest';
import { discoverVolumes } from '../src/discovery.js';

describe('discoverVolumes() (§9 — real, whole-machine storage discovery)', () => {
  it('discovers at least one real mounted filesystem with plausible fields', async () => {
    const volumes = await discoverVolumes();

    expect(volumes.length).toBeGreaterThan(0);
    for (const volume of volumes) {
      expect(typeof volume.mount).toBe('string');
      expect(volume.totalBytes).toBeGreaterThanOrEqual(0);
      expect(volume.usedPercent).toBeGreaterThanOrEqual(0);
    }
  });
});
