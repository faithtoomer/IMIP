import { describe, expect, it } from 'vitest';
import { ConfigurationAuthority } from '../src/ConfigurationAuthority.js';

describe('explainability / audit trail (§12)', () => {
  it('records every required field on a successful update', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();

    authority.requestUpdate('platform.locale', 'fr-FR', 'operator changed locale', 'Dashboard');

    const [record] = authority.audit.forKey('platform.locale');
    expect(record).toMatchObject({
      id: 'platform.locale',
      previousValue: 'en-US',
      newValue: 'fr-FR',
      reason: 'operator changed locale',
      initiatingAuthority: 'Dashboard',
      validationOutcome: 'valid',
      approvalStatus: 'approved',
    });
    expect(typeof record.timestamp).toBe('string');
    expect(() => new Date(record.timestamp).toISOString()).not.toThrow();
  });

  it('audit records are immutable once written', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();
    authority.requestUpdate('platform.locale', 'fr-FR', 'operator changed locale', 'Dashboard');

    const [record] = authority.audit.forKey('platform.locale');
    expect(Object.isFrozen(record)).toBe(true);
    expect(() => {
      (record as { reason: string }).reason = 'tampered';
    }).toThrow();
  });

  it('no configuration change happens without a corresponding audit record', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();
    const before = authority.audit.all().length;

    authority.requestUpdate('platform.debugMode', true, 'enable debug logging', 'Dashboard');

    expect(authority.audit.all().length).toBe(before + 1);
  });
});
