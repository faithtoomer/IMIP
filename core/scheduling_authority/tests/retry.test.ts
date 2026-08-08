import { describe, expect, it } from 'vitest';
import { computeRetryDelayMs } from '../src/retry.js';

describe('computeRetryDelayMs() (§12 — retry strategies)', () => {
  it('immediate returns 0', () => {
    expect(computeRetryDelayMs({ strategy: 'immediate' }, 1)).toBe(0);
  });

  it('fixed-interval returns the configured interval', () => {
    expect(computeRetryDelayMs({ strategy: 'fixed-interval', intervalMs: 5000 }, 1)).toBe(5000);
  });

  it('exponential-backoff grows with attempt count', () => {
    const policy = { strategy: 'exponential-backoff' as const, intervalMs: 1000, backoffMultiplier: 2 };
    expect(computeRetryDelayMs(policy, 1)).toBe(1000);
    expect(computeRetryDelayMs(policy, 2)).toBe(2000);
    expect(computeRetryDelayMs(policy, 3)).toBe(4000);
  });

  it('manual always returns undefined — requires operator recovery', () => {
    expect(computeRetryDelayMs({ strategy: 'manual' }, 1)).toBeUndefined();
  });

  it('returns undefined once maxAttempts is reached', () => {
    const policy = { strategy: 'fixed-interval' as const, intervalMs: 100, maxAttempts: 3 };
    expect(computeRetryDelayMs(policy, 2)).toBe(100);
    expect(computeRetryDelayMs(policy, 3)).toBeUndefined();
    expect(computeRetryDelayMs(policy, 4)).toBeUndefined();
  });
});
