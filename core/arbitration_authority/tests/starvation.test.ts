import { describe, expect, it } from 'vitest';
import { StarvationDetector } from '../src/starvation.js';
import { makeAuthority, makeClock, makeRequest } from './testHelpers.js';

describe('IRAA starvation prevention', () => {
  it('tracks wait time across simulated arbitration cycles and emits starvation evidence', () => {
    const clock = makeClock(); const authority = makeAuthority({ now: clock.now, starvationThresholdMs: 1_000, queueImbalanceThresholdMs: 1_000 });
    const findings: unknown[] = []; authority.subscribe('StarvationDetected', (finding) => findings.push(finding));
    authority.arbitrate([makeRequest({ requestId: 'old', priority: 1 }), makeRequest({ requestId: 'first-winner', owner: 'other', priority: 2 })]);
    clock.advance(2_000);
    authority.arbitrate([makeRequest({ requestId: 'old', priority: 1 }), makeRequest({ requestId: 'new', owner: 'third', priority: 4 })]);
    expect(findings).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'long-waiting-request', requestIds: ['old'] }), expect.objectContaining({ kind: 'queue-imbalance' })]));
  });
  it('detects priority inversion and repeated-owner monopolization without allocating a resource', () => {
    const detector = new StarvationDetector({ monopolizationGrantThreshold: 1 }); const now = '2026-08-08T20:00:00.000Z';
    const low = makeRequest({ requestId: 'low', owner: 'owner-a', priority: 1 }); const high = makeRequest({ requestId: 'high', owner: 'owner-b', priority: 9 });
    detector.observe([low, high], now); detector.recordDecision('gpu-001', [low, high], 'low');
    const findings = detector.detect('gpu-001', [low, high], 'low', now);
    expect(findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining(['priority-inversion', 'resource-monopolization']));
  });
});
