import { describe, expect, it } from 'vitest';
import {
  createConfigurationVersionSource,
  createDatabaseVersionSource,
  createEventSchemaVersionSource,
  createNoopVersionSource,
} from '../src/versionSources.js';
import { ConfigurationAuthority } from '../../configuration_authority/src/index.js';
import { DataAuthority } from '../../data_authority/src/index.js';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';

describe('Artifact version sources (§6/Law 2 — real, not fabricated version data)', () => {
  it('createConfigurationVersionSource reads ICMS\'s real, already-existing getVersionInfo()', () => {
    const configurationAuthority = new ConfigurationAuthority({ argv: [], env: {} });
    configurationAuthority.load();
    const source = createConfigurationVersionSource(configurationAuthority);

    const [snapshot] = source.currentVersions();
    expect(snapshot.artifactType).toBe('configuration-schema');
    expect(snapshot.semanticVersion).toBe(configurationAuthority.getVersionInfo().schemaVersion);
  });

  it('createDatabaseVersionSource reads IDA\'s real, already-existing per-domain schema versions', () => {
    const dataAuthority = new DataAuthority();
    dataAuthority.registerDomainSchema({ domain: 'benchmark-results', version: 3, fields: [{ name: 'name', type: 'string' }] });
    const source = createDatabaseVersionSource(dataAuthority);

    const snapshots = source.currentVersions();
    const benchmarkSnapshot = snapshots.find((snapshot) => snapshot.artifactName === 'benchmark-results');
    expect(benchmarkSnapshot?.semanticVersion).toBe('3');
    dataAuthority.close();
  });

  it('createEventSchemaVersionSource reads the Event Bus\'s real, already-existing per-event versions', () => {
    const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    bus.registerEventType({
      id: 'test.Something',
      name: 'Something',
      category: 'diagnostics',
      description: 'x',
      publisherAuthority: 'Test',
      priority: 'normal',
      deliveryMode: 'async',
      targeting: 'broadcast',
      version: '2.1.0',
    });
    const source = createEventSchemaVersionSource(bus);

    const snapshots = source.currentVersions();
    expect(snapshots.some((s) => s.artifactName === 'Something' && s.semanticVersion === '2.1.0')).toBe(true);
  });

  it('createNoopVersionSource is an honest, empty extension point — not fabricated data', () => {
    const source = createNoopVersionSource('plugin-manifest');
    expect(source.currentVersions()).toEqual([]);
  });
});
