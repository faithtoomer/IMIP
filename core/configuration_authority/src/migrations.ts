import type { ConfigValues, MigrationDefinition, MigrationRecord } from './types.js';

/**
 * §15 — migration framework. Applies registered migrations in a chain starting
 * from the caller's current schema version, until no further migration applies.
 * Bounded at 100 hops as a runaway-chain backstop (real deployments will never
 * approach this).
 *
 * ICMS ships with zero registered migrations (see DEFAULT_MIGRATIONS below):
 * the 1.0.0 -> 2.0.0 schema bump changed only registry metadata (security
 * classification tiers), not value shapes, so no value transformation is
 * required for any currently-registered key. The framework itself is fully
 * functional — see tests/migrations.test.ts for an end-to-end exercise using a
 * synthetic migration.
 */
export const DEFAULT_MIGRATIONS: MigrationDefinition[] = [];

export class MigrationRunner {
  constructor(private readonly migrations: MigrationDefinition[] = DEFAULT_MIGRATIONS) {}

  applicableFrom(schemaVersion: string): MigrationDefinition[] {
    return this.migrations.filter((migration) => migration.fromSchemaVersion === schemaVersion);
  }

  run(
    values: ConfigValues,
    fromSchemaVersion: string,
  ): { values: ConfigValues; applied: MigrationRecord[]; finalSchemaVersion: string } {
    let working = values;
    let version = fromSchemaVersion;
    const applied: MigrationRecord[] = [];

    for (let hop = 0; hop < 100; hop += 1) {
      const next = this.migrations.find((migration) => migration.fromSchemaVersion === version);
      if (!next) break;

      const before = working;
      working = next.migrate(working);
      const affectedKeys = Object.keys(working).filter((key) => before[key] !== working[key]);

      applied.push({
        migrationId: next.id,
        fromSchemaVersion: next.fromSchemaVersion,
        toSchemaVersion: next.toSchemaVersion,
        timestamp: new Date().toISOString(),
        affectedKeys,
      });

      version = next.toSchemaVersion;
    }

    return { values: working, applied, finalSchemaVersion: version };
  }
}
