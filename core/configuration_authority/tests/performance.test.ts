import { describe, expect, it } from 'vitest';
import { ConfigurationAuthority } from '../src/ConfigurationAuthority.js';

/**
 * §19 — lightweight performance smoke test. Not a benchmarking suite: the
 * registry currently holds 44 entries, so these bounds are generous by
 * design and exist to catch an accidental O(n^2)+ regression, not to
 * micro-benchmark the implementation.
 */
describe('performance smoke tests', () => {
  it('load() completes well under 200ms for the current registry size', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    const start = performance.now();
    authority.load();
    expect(performance.now() - start).toBeLessThan(200);
  });

  it('1000 requestUpdate() calls complete well under 2s', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();

    const start = performance.now();
    for (let i = 0; i < 1000; i += 1) {
      authority.requestUpdate('mining.idleTimeout', i, 'perf test', 'Dashboard');
    }
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
