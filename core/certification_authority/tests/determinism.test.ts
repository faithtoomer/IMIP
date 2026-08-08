import { describe, expect, it } from 'vitest';
import { fullEvidence, makeAuthority, makeRequest, providersFromEvidence } from './testHelpers.js';

describe('IHCA determinism', () => {
  it('produces an identical evidence-driven decision for identical evidence, policies, and injected clock', () => {
    const evidence = fullEvidence(95, 'deterministic');
    const firstAuthority = makeAuthority({ providers: providersFromEvidence(() => evidence) });
    const secondAuthority = makeAuthority({ providers: providersFromEvidence(() => [...evidence].reverse()) });
    const first = firstAuthority.start(makeRequest({ level: 'mission-critical' }));
    const second = secondAuthority.start(makeRequest({ level: 'mission-critical' }));
    expect(secondAuthority.evaluate(second.certificationId)).toEqual(firstAuthority.evaluate(first.certificationId));
  });

  it('does not make discovery, allocation, runtime, scheduling, or workload actions as part of a decision', () => {
    const authority = makeAuthority();
    const started = authority.start(makeRequest());
    const decision = authority.evaluate(started.certificationId);
    expect(decision.passed).toBe(true);
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(authority))).not.toEqual(expect.arrayContaining([
      'discover', 'registerHardware', 'allocate', 'reserve', 'schedule', 'startRuntime', 'stopRuntime', 'executeBenchmark',
    ]));
  });
});
