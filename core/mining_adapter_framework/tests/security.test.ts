import { describe, expect, it } from 'vitest';
import { assertNoRawCredentials, redactSecrets } from '../src/security.js';
import { MockCpuAdapter } from '../src/mockAdapters.js';
import { cpuConfig, cpuStatsNormalizer, cpuTranslator, makeFramework } from './testHelpers.js';

describe('IMAF secret-provider and diagnostics boundary', () => {
  it('accepts only secret references in institutional configuration and rejects raw credential fields', () => {
    expect(() => assertNoRawCredentials(cpuConfig())).not.toThrow();
    expect(() => assertNoRawCredentials({ ...cpuConfig(), options: { poolPassword: 'must-not-enter-imaf' } })).toThrow('Raw credential');
  });
  it('redacts secret-bearing keys and known values from framework diagnostics or log structures', async () => {
    const raw = { message: 'backend saw pool-password-raw-value', wallet: 'wallet-raw-value', nested: { authorization: 'Bearer raw' }, safe: 'kept' };
    const redacted = redactSecrets(raw, ['pool-password-raw-value', 'wallet-raw-value']);
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain('pool-password-raw-value'); expect(serialized).not.toContain('wallet-raw-value'); expect(serialized).not.toContain('Bearer raw');
    expect(redacted).toEqual({ message: 'backend saw [REDACTED]', wallet: '[REDACTED]', nested: { authorization: '[REDACTED]' }, safe: 'kept' });
    const adapter = new MockCpuAdapter();
    adapter.diagnostics = async () => ({ details: raw });
    const framework = makeFramework(); await framework.registerAdapter(adapter, { configTranslator: cpuTranslator, statisticsNormalizer: cpuStatsNormalizer });
    await framework.validateAdapter('mock-cpu', { adapterId: 'mock-cpu', operatingSystem: 'linux', hardware: { kind: 'cpu', capabilities: ['cpu-mining'] }, algorithm: 'test-hash-cpu', poolProtocol: 'test-pool' }, cpuConfig());
    await framework.configureAdapter('mock-cpu', cpuConfig());
    const frameworkDiagnostics = await framework.diagnostics('mock-cpu');
    expect(JSON.stringify(frameworkDiagnostics)).not.toContain('pool-password-raw-value');
    expect(JSON.stringify(frameworkDiagnostics)).not.toContain('wallet-raw-value');
    expect(JSON.stringify(frameworkDiagnostics)).not.toContain('Bearer raw');
  });
});
