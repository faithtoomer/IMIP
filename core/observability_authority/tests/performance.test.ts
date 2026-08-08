import { describe, expect, it, vi } from 'vitest';
import { ObservabilityAuthority } from '../src/ObservabilityAuthority.js';
import { allow } from './testHelpers.js';

describe('performance smoke tests', () => {
  it('logs 1000 entries well under 1s with an in-memory-only configuration', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const iola = new ObservabilityAuthority();
    allow(iola, 'runtime', 'op');

    const start = performance.now();
    for (let i = 0; i < 1000; i += 1) {
      iola.log({ severity: 'information', category: 'runtime', authority: 'X', operation: 'op', message: `msg ${i}` });
    }
    expect(performance.now() - start).toBeLessThan(1000);
    expect(iola.getMetrics().totalLogged).toBe(1000);
    logSpy.mockRestore();
  });
});
