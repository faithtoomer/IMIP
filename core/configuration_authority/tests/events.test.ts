import { describe, expect, it } from 'vitest';
import { ConfigurationAuthority } from '../src/ConfigurationAuthority.js';
import { CONFIG_EVENTS } from '../src/events.js';

describe('Configuration Authority events', () => {
  it('publishes Validated, SnapshotCreated, and Loaded in order on load()', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    const seen: string[] = [];
    authority.subscribe(CONFIG_EVENTS.Validated, () => seen.push(CONFIG_EVENTS.Validated));
    authority.subscribe(CONFIG_EVENTS.SnapshotCreated, () => seen.push(CONFIG_EVENTS.SnapshotCreated));
    authority.subscribe(CONFIG_EVENTS.Loaded, () => seen.push(CONFIG_EVENTS.Loaded));

    authority.load();

    expect(seen).toEqual([CONFIG_EVENTS.Validated, CONFIG_EVENTS.SnapshotCreated, CONFIG_EVENTS.Loaded]);
  });

  it('publishes Reloaded in addition to the load() sequence on reload()', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();

    const seen: string[] = [];
    authority.subscribe(CONFIG_EVENTS.Reloaded, () => seen.push(CONFIG_EVENTS.Reloaded));
    authority.reload();

    expect(seen).toEqual([CONFIG_EVENTS.Reloaded]);
  });

  it('publishes Updated and SnapshotCreated on a successful requestUpdate()', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    authority.load();

    const seen: string[] = [];
    authority.subscribe(CONFIG_EVENTS.Updated, () => seen.push(CONFIG_EVENTS.Updated));
    authority.subscribe(CONFIG_EVENTS.SnapshotCreated, () => seen.push(CONFIG_EVENTS.SnapshotCreated));

    authority.requestUpdate('platform.locale', 'fr-FR', 'operator request', 'Dashboard');

    expect(seen).toEqual([CONFIG_EVENTS.Updated, CONFIG_EVENTS.SnapshotCreated]);
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
