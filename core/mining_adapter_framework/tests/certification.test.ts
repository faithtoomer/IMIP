import { describe, expect, it } from 'vitest';
import { AdapterCertificationError } from '../src/errors.js';
import { makeFramework, registerCpu } from './testHelpers.js';

describe('IMAF lightweight adapter certification', () => {
  it('tracks deterministic adapter certification transitions separately from hardware certification', async () => {
    const framework = makeFramework(); await registerCpu(framework);
    expect(framework.certificationStatus('mock-cpu')).toMatchObject({ status: 'experimental', rationale: 'Declared by adapter manifest.' });
    expect(framework.certifyAdapter('mock-cpu', 'development', 'fixture completed development checks')).toMatchObject({ status: 'development' });
    expect(framework.certifyAdapter('mock-cpu', 'qualified', 'fixture qualified')).toMatchObject({ status: 'qualified' });
    expect(framework.certifyAdapter('mock-cpu', 'production', 'fixture approved')).toMatchObject({ status: 'production' });
    expect(framework.certifyAdapter('mock-cpu', 'mission-critical', 'fixture critical')).toMatchObject({ status: 'mission-critical' });
    expect(framework.certifyAdapter('mock-cpu', 'revoked', 'fixture incident')).toMatchObject({ status: 'revoked' });
  });
  it('rejects unexplained or skipped certification status changes', async () => {
    const framework = makeFramework(); await registerCpu(framework);
    expect(() => framework.certifyAdapter('mock-cpu', 'production', '')).toThrow(AdapterCertificationError);
    expect(() => framework.certifyAdapter('mock-cpu', 'production', 'skip')).toThrow(AdapterCertificationError);
  });
});
