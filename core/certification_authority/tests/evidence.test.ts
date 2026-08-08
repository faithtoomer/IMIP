import { describe, expect, it } from 'vitest';
import { EvidenceImmutabilityError } from '../src/errors.js';
import { makeAuthority, makeEvidence, makeRequest, providersFromEvidence } from './testHelpers.js';

describe('IHCA immutable certification evidence', () => {
  it('snapshots and deeply freezes evidence attached to an evaluation, while allowing only new observations later', () => {
    const incoming = makeEvidence('health', 100, 'original');
    incoming.metrics.reliabilityScore = 100;
    incoming.metrics.stabilityScore = 100;
    const authority = makeAuthority({ providers: providersFromEvidence(() => [incoming]) });
    const started = authority.start(makeRequest({ level: 'experimental' }));
    authority.evaluate(started.certificationId);
    incoming.metrics.stabilityScore = 0;
    incoming.references?.push('mutated-outside');
    const stored = authority.evidence.evidenceFor(started.certificationId)[0]!;
    expect(stored.metrics.stabilityScore).toBe(100);
    expect(stored.references).not.toContain('mutated-outside');
    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.metrics)).toBe(true);
    expect(() => authority.evidence.attach(started.certificationId, [stored], '2026-08-08T20:01:00.000Z'))
      .toThrow(EvidenceImmutabilityError);
    const later = makeEvidence('health', 95, 'new-observation');
    authority.evidence.attach(started.certificationId, [later], '2026-08-08T20:01:00.000Z');
    expect(authority.evidence.evidenceFor(started.certificationId).map((entry) => entry.evidenceId))
      .toEqual(['health-original', 'health-new-observation']);
  });
});
