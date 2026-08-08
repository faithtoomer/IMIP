import { describe, expect, it } from 'vitest';
import { ConfigurationAuthority } from '../src/ConfigurationAuthority.js';
import { CONFIG_EVENTS } from '../src/events.js';

describe('ICMS events (§16)', () => {
  it('publishes Validated, SnapshotCreated, SnapshotActivated, and Loaded in order on load()', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    const seen: string[] = [];
    authority.subscribe(CONFIG_EVENTS.Validated, () => seen.push(CONFIG_EVENTS.Validated));
    authority.subscribe(CONFIG_EVENTS.SnapshotCreated, () => seen.push(CONFIG_EVENTS.SnapshotCreated));
    authority.subscribe(CONFIG_EVENTS.SnapshotActivated, () => seen.push(CONFIG_EVENTS.SnapshotActivated));
    authority.subscribe(CONFIG_EVENTS.Loaded, () => seen.push(CONFIG_EVENTS.Loaded));

    authority.load();

    expect(seen).toEqual([
      CONFIG_EVENTS.Validated,
      CONFIG_EVENTS.SnapshotCreated,
      CONFIG_EVENTS.SnapshotActivated,
      CONFIG_EVENTS.Loaded,
    ]);
  });

  it('publishes the convenience Reloaded event in addition to the load() sequence on reload()', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();

    const seen: string[] = [];
    authority.subscribe(CONFIG_EVENTS.Reloaded, () => seen.push(CONFIG_EVENTS.Reloaded));
    authority.reload();

    expect(seen).toEqual([CONFIG_EVENTS.Reloaded]);
  });

  it('publishes SecretResolved for every key sourced from the secrets store, without leaking the value', () => {
    const authority = new ConfigurationAuthority({
      argv: [],
      env: {},
      secretsProvider: { get: (id) => (id === 'wallet.addresses' ? [{ coin: 'XMR', address: 'secret-address' }] : undefined) },
    });

    const payloads: unknown[] = [];
    authority.subscribe(CONFIG_EVENTS.SecretResolved, (payload) => payloads.push(payload));
    authority.load();

    expect(payloads).toEqual([{ id: 'wallet.addresses' }]);
  });

  it('publishes Changed, SnapshotCreated, and SnapshotActivated on a successful requestUpdate()', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();

    const seen: string[] = [];
    authority.subscribe(CONFIG_EVENTS.Changed, () => seen.push(CONFIG_EVENTS.Changed));
    authority.subscribe(CONFIG_EVENTS.SnapshotCreated, () => seen.push(CONFIG_EVENTS.SnapshotCreated));
    authority.subscribe(CONFIG_EVENTS.SnapshotActivated, () => seen.push(CONFIG_EVENTS.SnapshotActivated));

    authority.requestUpdate('platform.locale', 'fr-FR', 'operator request', 'Dashboard');

    expect(seen).toEqual([CONFIG_EVENTS.Changed, CONFIG_EVENTS.SnapshotCreated, CONFIG_EVENTS.SnapshotActivated]);
  });

  it('publishes Rejected on an invalid requestUpdate() and does not mutate the snapshot', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    const before = authority.load();

    let rejected = false;
    authority.subscribe(CONFIG_EVENTS.Rejected, () => {
      rejected = true;
    });

    expect(() => authority.requestUpdate('platform.logLevel', 'trace', 'bad input', 'Dashboard')).toThrow();
    expect(rejected).toBe(true);
    expect(authority.getSnapshot().version).toBe(before.version);
  });

  it('publishes SnapshotRolledBack on rollback()', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    const first = authority.load();
    authority.requestUpdate('platform.locale', 'fr-FR', 'operator request', 'Dashboard');

    let payload: unknown;
    authority.subscribe(CONFIG_EVENTS.SnapshotRolledBack, (p) => {
      payload = p;
    });

    authority.rollback(first.version, 'undo locale change', 'Dashboard');
    expect(payload).toEqual({ fromVersion: first.version + 1, toVersion: first.version });
  });

  it('subscribe() returns an unsubscribe function', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    let count = 0;
    const unsubscribe = authority.subscribe(CONFIG_EVENTS.Loaded, () => {
      count += 1;
    });
    authority.load();
    unsubscribe();
    authority.reload();
    expect(count).toBe(1);
  });
});
