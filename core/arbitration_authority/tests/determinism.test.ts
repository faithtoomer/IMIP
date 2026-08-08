import { describe, expect, it } from 'vitest';
import { makeAuthority, makeRequest } from './testHelpers.js';

describe('IRAA determinism', () => {
  it('produces identical decisions for identical inputs, policies, provider evidence, history, and injected clock', () => {
    const requests = [makeRequest({ requestId: 'request-z', priority: 2 }), makeRequest({ requestId: 'request-a', owner: 'owner-b', priority: 2 })];
    const first = makeAuthority().arbitrate(requests);
    const second = makeAuthority().arbitrate([...requests].reverse());
    expect(second).toEqual(first);
    expect(first.winningRequestId).toBe('request-a');
  });
  it('labels a decision as not submitted so a caller—not IRAA—must perform any later IRIA call', () => {
    expect(makeAuthority().arbitrate([makeRequest(), makeRequest({ requestId: 'b', owner: 'b' })]).allocationSubmitted).toBe(false);
  });
});
