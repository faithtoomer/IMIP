import { describe, expect, it } from 'vitest';
import { ARBITRATION_LIFECYCLE, assertArbitrationLifecycleTransition } from '../src/lifecycle.js';
import { ArbitrationLifecycleError } from '../src/errors.js';
import { makeAuthority, makeRequest } from './testHelpers.js';

describe('IRAA seven-stage lifecycle', () => {
  it('records every guarded lifecycle transition from received through archived', () => {
    const authority = makeAuthority(); const decision = authority.arbitrate([makeRequest(), makeRequest({ requestId: 'b', owner: 'b' })]);
    expect(authority.getLifecycle(decision.arbitrationId).map((record) => record.to)).toEqual(ARBITRATION_LIFECYCLE);
    expect(authority.registry.require(decision.arbitrationId).stage).toBe('history-archived');
  });
  it('rejects skipped, reversed, and post-archive lifecycle transitions', () => {
    expect(() => assertArbitrationLifecycleTransition(undefined, 'winner-selected')).toThrow(ArbitrationLifecycleError);
    expect(() => assertArbitrationLifecycleTransition('history-archived', 'request-received')).toThrow(ArbitrationLifecycleError);
  });
  it('retains a failed lifecycle record at its last reached stage', () => {
    const authority = makeAuthority({ providers: { availability: { getAvailability: () => { throw new Error('provider unavailable'); } } } });
    expect(() => authority.arbitrate([makeRequest(), makeRequest({ requestId: 'b', owner: 'b' })])).toThrow('provider unavailable');
    expect(authority.registry.all()[0]).toMatchObject({ stage: 'policy-evaluation', failureReason: 'provider unavailable' });
  });
});
