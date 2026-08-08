import type { ConfigurationAuthority } from '../../configuration_authority/src/index.js';
import type { DataAuthority } from '../../data_authority/src/index.js';
import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import type { ArtifactVersionSource, VersionSnapshot } from './types.js';

/** §6/Law 2 — wraps ICMS's real, already-existing `getVersionInfo()`
 * (Phase 02). IVGMA never invents a parallel configuration version number. */
export function createConfigurationVersionSource(configurationAuthority: ConfigurationAuthority): ArtifactVersionSource {
  return {
    artifactType: 'configuration-schema',
    currentVersions(): VersionSnapshot[] {
      const info = configurationAuthority.getVersionInfo();
      return [
        {
          artifactType: 'configuration-schema',
          artifactName: 'icms-configuration',
          semanticVersion: info.schemaVersion,
          compatibilityVersion: info.compatibilityVersion,
          migrationVersion: info.migrationVersion,
          metadata: { runtimeVersion: info.runtimeVersion },
        },
      ];
    },
  };
}

/** §6/Law 2 — wraps IDA's real, already-existing per-domain
 * `DomainSchema.version` (Phase 08). One VersionSnapshot per registered
 * domain — real data, not fabricated. */
export function createDatabaseVersionSource(dataAuthority: DataAuthority): ArtifactVersionSource {
  return {
    artifactType: 'database-schema',
    currentVersions(): VersionSnapshot[] {
      return dataAuthority.schemas.all().map((schema) => ({
        artifactType: 'database-schema',
        artifactName: schema.domain,
        semanticVersion: String(schema.version),
      }));
    },
  };
}

/** §6/Law 2 — wraps the Event Bus's real, already-existing per-event
 * `EventDefinition.version` (Phase 05). One VersionSnapshot per registered
 * event definition. */
export function createEventSchemaVersionSource(eventBus: InstitutionalEventBus): ArtifactVersionSource {
  return {
    artifactType: 'event-schema',
    currentVersions(): VersionSnapshot[] {
      return eventBus.getEventDefinitions().map((definition) => ({
        artifactType: 'event-schema',
        artifactName: definition.name,
        semanticVersion: definition.version,
        metadata: { category: definition.category, deprecated: definition.deprecated ?? false },
      }));
    },
  };
}

/** A real, zero-producer extension point for artifact types with no real
 * version source yet (Plugin Registry, Capability Registry, Policy
 * Authority — all still reserved). Honest empty result, not fabricated
 * version numbers. */
export function createNoopVersionSource(artifactType: string): ArtifactVersionSource {
  return {
    artifactType,
    currentVersions(): VersionSnapshot[] {
      return [];
    },
  };
}
