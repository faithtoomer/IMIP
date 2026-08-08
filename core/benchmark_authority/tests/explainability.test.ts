import { describe, expect, it } from 'vitest';
import { FakeIHISBenchmarkRegistry, completeToStored, makeAuthority, makeInput } from './testHelpers.js';

describe('IBIA benchmark explainability', () => {
  it('answers what was measured, why, conditions, baseline, change, and recommendation', () => {
    const authority = makeAuthority({ providers: { hardwareStore: new FakeIHISBenchmarkRegistry() } });
    const baseline = completeToStored(authority, makeInput(), 100);
    authority.compare(baseline.runId);
    authority.archive(baseline.runId);
    const current = completeToStored(authority, makeInput(), 80);
    authority.compare(current.runId);
    const explanation = authority.explain(current.runId);
    expect(explanation.whatWasMeasured).toContain('hashrate: 80 H/s');
    expect(explanation.why).toContain('Establish institutional mining baseline');
    expect(explanation.conditions).toContain('runtime node-22');
    expect(explanation.conditions).toContain('100 W');
    expect(explanation.baseline).toContain(baseline.runId);
    expect(explanation.whatChanged).toContain('regressed');
    expect(explanation.recommendation).toContain('investigate');
    expect(explanation.lifecycle.map((record) => record.to)).toEqual(['created', 'validated', 'scheduled', 'executed', 'verified', 'stored', 'compared']);
  });

  it('explains an initial stored benchmark honestly when no comparison has been recorded', () => {
    const authority = makeAuthority({ providers: { hardwareStore: new FakeIHISBenchmarkRegistry() } });
    const run = completeToStored(authority, makeInput(), 100);
    const explanation = authority.explain(run.runId);
    expect(explanation.baseline).toContain('No comparison');
    expect(explanation.whatChanged).toContain('not yet been compared');
    expect(explanation.recommendation).toContain('No advisory recommendation');
  });

  it('preserves failure evidence without incorrectly changing the lifecycle explanation', () => {
    const authority = makeAuthority();
    const run = authority.create(makeInput());
    authority.fail(run.runId, 'Runner unavailable.');
    expect(authority.explain(run.runId).lifecycle.map((record) => record.to)).toEqual(['created']);
  });
});
