import { describe, expect, it } from 'vitest';
import { cpuRequest, makeFramework, registerCpu } from './testHelpers.js';

describe('IMAF explainability', () => {
  it('answers why an adapter was accepted or rejected by capability negotiation', async () => {
    const framework = makeFramework(); await registerCpu(framework);
    const accepted = framework.explainNegotiation('mock-cpu', cpuRequest());
    const rejected = framework.explainNegotiation('mock-cpu', cpuRequest({ algorithm: 'other' }));
    expect(accepted).toMatchObject({ adapterId: 'mock-cpu', accepted: true, rejected: [] });
    expect(accepted.rationale).toContain('Every requested');
    expect(rejected).toMatchObject({ accepted: false }); expect(rejected.rejected.join(' ')).toContain('Algorithm other is not supported');
  });
  it('answers why a backend error received its institutional category', async () => {
    const framework = makeFramework(); await registerCpu(framework);
    expect(framework.explainError('mock-cpu', { code: 'NET_TIMEOUT', message: 'network timeout' })).toMatchObject({ category: 'NetworkFailure', retriable: true, source: 'structural-error-classifier' });
  });
});
