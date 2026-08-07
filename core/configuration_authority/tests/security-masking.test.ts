import { describe, expect, it } from 'vitest';
import { ConfigurationAuthority } from '../src/ConfigurationAuthority.js';
import { REDACTED } from '../src/security.js';

describe('sensitive value masking (§11)', () => {
  it('getMaskedSnapshot redacts sensitive keys but leaves public keys intact', () => {
    const authority = new ConfigurationAuthority({
      argv: [],
      env: {},
      secretsProvider: { get: (id) => (id === 'wallet.addresses' ? [{ coin: 'XMR', address: 'real-address' }] : undefined) },
    });
    authority.load();

    const masked = authority.getMaskedSnapshot();
    expect(masked['wallet.addresses']).toBe(REDACTED);
    expect(masked['platform.name']).toBe('IMIP');
  });

  it('get() still returns the real value for authorized in-process reads', () => {
    const authority = new ConfigurationAuthority({
      argv: [],
      env: {},
      secretsProvider: { get: (id) => (id === 'wallet.addresses' ? [{ coin: 'XMR', address: 'real-address' }] : undefined) },
    });
    authority.load();
    expect(authority.get('wallet.addresses')).toEqual([{ coin: 'XMR', address: 'real-address' }]);
  });

  it('audit records for sensitive keys carry redacted values, never the raw value', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();

    authority.requestUpdate('wallet.minimumPayout', 0.02, 'operator adjustment', 'Dashboard');
    // minimumPayout is public; verify a sensitive key redacts instead.
    expect(() =>
      authority.requestUpdate('wallet.payoutPreferences', { method: 'auto' }, 'operator adjustment', 'Dashboard'),
    ).not.toThrow();

    const records = authority.audit.forKey('wallet.payoutPreferences');
    expect(records.length).toBe(1);
    expect(records[0].previousValue).toBe(REDACTED);
    expect(records[0].newValue).toBe(REDACTED);
  });

  it('a rejected update on a sensitive key still redacts the audit record', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();

    expect(() => authority.requestUpdate('wallet.addresses', 'not-an-array', 'bad input', 'Dashboard')).toThrow();

    const records = authority.audit.forKey('wallet.addresses');
    expect(records.length).toBe(1);
    expect(records[0].newValue).toBe(REDACTED);
    expect(records[0].approvalStatus).toBe('rejected');
  });
});
