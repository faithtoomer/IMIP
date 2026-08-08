import { describe, expect, it } from 'vitest';
import { ConfigurationAuthority } from '../src/ConfigurationAuthority.js';

describe('configuration provenance (§12)', () => {
  it('answers what/who/where/when/which-snapshot for every key after load()', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    const snapshot = authority.load();

    const provenance = authority.getProvenance('platform.locale');
    expect(provenance).toBeDefined();
    expect(provenance?.currentValue).toBe('en-US');
    expect(provenance?.originalSource).toBe('default');
    expect(provenance?.ownerAuthority).toBe('Configuration Authority');
    expect(provenance?.snapshotVersion).toBe(snapshot.version);
    expect(provenance?.validationResult).toBe('valid');
    expect(typeof provenance?.validationTimestamp).toBe('string');
  });

  it('reflects the winning source, not just "default"', () => {
    const authority = new ConfigurationAuthority({ argv: ['--platform.locale=fr-FR'], env: {} });
    authority.load();
    expect(authority.getProvenance('platform.locale')?.originalSource).toBe('cli');
  });

  it('appends to overrideHistory on every requestUpdate(), never overwriting it', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();

    authority.requestUpdate('platform.locale', 'fr-FR', 'first change', 'Dashboard');
    authority.requestUpdate('platform.locale', 'de-DE', 'second change', 'Dashboard');

    const provenance = authority.getProvenance('platform.locale');
    expect(provenance?.overrideHistory).toHaveLength(2);
    expect(provenance?.overrideHistory[0]).toMatchObject({ previousValue: 'en-US', newValue: 'fr-FR' });
    expect(provenance?.overrideHistory[1]).toMatchObject({ previousValue: 'fr-FR', newValue: 'de-DE' });
    expect(provenance?.currentValue).toBe('de-DE');
  });

  it('override history entries are immutable once recorded', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();
    authority.requestUpdate('platform.locale', 'fr-FR', 'change', 'Dashboard');

    const [override] = authority.getProvenance('platform.locale')!.overrideHistory;
    expect(Object.isFrozen(override)).toBe(true);
  });

  it('snapshotVersion advances with every successful load or update', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    const first = authority.load();
    expect(authority.getProvenance('platform.locale')?.snapshotVersion).toBe(first.version);

    const updated = authority.requestUpdate('platform.locale', 'fr-FR', 'change', 'Dashboard');
    expect(authority.getProvenance('platform.locale')?.snapshotVersion).toBe(updated.version);
  });
});
