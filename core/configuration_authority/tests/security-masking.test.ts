import { describe, expect, it } from 'vitest';
import { ConfigurationAuthority } from '../src/ConfigurationAuthority.js';
import { REDACTED, shouldMask } from '../src/security.js';

describe('shouldMask (§13 five-tier classification)', () => {
  it('masks confidential, restricted, and secret; leaves public and internal unmasked', () => {
    expect(shouldMask('public')).toBe(false);
    expect(shouldMask('internal')).toBe(false);
    expect(shouldMask('confidential')).toBe(true);
    expect(shouldMask('restricted')).toBe(true);
    expect(shouldMask('secret')).toBe(true);
  });
});

describe('sensitive value masking end-to-end', () => {
  it('getMaskedSnapshot redacts secret/restricted keys but leaves public/internal keys intact', () => {
    const authority = new ConfigurationAuthority({
      argv: [],
      env: {},
      secretsProvider: { get: (id) => (id === 'wallet.addresses' ? [{ coin: 'XMR', address: 'real-address' }] : undefined) },
    });
    authority.load();

    const masked = authority.getMaskedSnapshot();
    expect(masked['wallet.addresses']).toBe(REDACTED); // secret
    expect(masked['wallet.payoutPreferences']).toBe(REDACTED); // restricted
    expect(masked['platform.name']).toBe('IMIP'); // public
    expect(masked['electricity.rate']).toBe(0.12); // internal — not masked
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

  it('audit records for secret/restricted keys carry redacted values, never the raw value', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();

    authority.requestUpdate('wallet.payoutPreferences', { method: 'auto' }, 'operator adjustment', 'Dashboard');

    const records = authority.audit.forKey('wallet.payoutPreferences');
    expect(records.length).toBe(1);
    expect(records[0].previousValue).toBe(REDACTED);
    expect(records[0].newValue).toBe(REDACTED);
  });

  it('a rejected update on a secret key still redacts the audit record', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();

    expect(() => authority.requestUpdate('wallet.addresses', 'not-an-array', 'bad input', 'Dashboard')).toThrow();

    const records = authority.audit.forKey('wallet.addresses');
    expect(records.length).toBe(1);
    expect(records[0].newValue).toBe(REDACTED);
    expect(records[0].approvalStatus).toBe('rejected');
  });

  it('getProvenance masks currentValue and history for secret/restricted keys', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();
    authority.requestUpdate('wallet.payoutPreferences', { method: 'manual' }, 'operator adjustment', 'Dashboard');

    const provenance = authority.getProvenance('wallet.payoutPreferences');
    expect(provenance?.currentValue).toBe(REDACTED);
    expect(provenance?.overrideHistory[0].newValue).toBe(REDACTED);
  });

  it('getProvenance leaves public/internal keys unmasked', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();
    const provenance = authority.getProvenance('electricity.rate');
    expect(provenance?.currentValue).toBe(0.12);
  });
});
