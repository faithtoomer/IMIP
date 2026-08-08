import type { RetryPolicy } from './types.js';

/** §12 — real retry-delay computation. Returns `undefined` when retries are
 * exhausted (attempt >= maxAttempts) or the strategy is `manual` (requires
 * operator recovery, per §12). */
export function computeRetryDelayMs(policy: RetryPolicy, attempt: number): number | undefined {
  const maxAttempts = policy.maxAttempts ?? Infinity;
  if (attempt >= maxAttempts) return undefined;

  switch (policy.strategy) {
    case 'immediate':
      return 0;
    case 'fixed-interval':
      return policy.intervalMs ?? 0;
    case 'exponential-backoff': {
      const base = policy.intervalMs ?? 1000;
      const multiplier = policy.backoffMultiplier ?? 2;
      return base * multiplier ** (attempt - 1);
    }
    case 'manual':
      return undefined;
  }
}
