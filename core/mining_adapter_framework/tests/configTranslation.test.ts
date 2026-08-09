import { describe, expect, it } from 'vitest';
import { ConfigTranslatorRegistry } from '../src/configTranslation.js';
import { cpuConfig, cpuTranslator } from './testHelpers.js';

describe('IMAF adapter-owned configuration translation', () => {
  it('translates institutional configuration through a mock adapter translator without exposing credentials', () => {
    const registry = new ConfigTranslatorRegistry(); registry.register('mock-cpu', cpuTranslator);
    const input = cpuConfig(); const backend = registry.translate(input);
    expect(backend).toEqual({ adapterId: 'mock-cpu', values: { endpoint: 'test://pool.example', worker: 'cpu-worker', algorithm: 'test-hash-cpu', threads: 4 }, secretReferences: { wallet: 'wallet-ref', password: 'password-ref' } });
    expect(JSON.stringify(backend)).not.toContain('wallet-raw-value');
    expect({ algorithm: backend.values.algorithm, endpoint: backend.values.endpoint, walletReference: backend.secretReferences.wallet }).toEqual({ algorithm: input.algorithm, endpoint: input.pool.endpoint, walletReference: input.pool.walletSecretId });
  });
});
