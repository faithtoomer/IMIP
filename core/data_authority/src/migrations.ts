import type { DataDomain, DataMigrationDefinition } from './types.js';

/**
 * §10 — data migration framework for domain schema version bumps. Ships with
 * zero default migrations for the same reason ICMS's does: no domain schema
 * has changed shape since it was introduced. The framework itself is
 * complete and tested (see tests/migrations.test.ts), not a stub.
 */
export class DataMigrationRunner {
  constructor(private readonly migrations: DataMigrationDefinition[] = []) {}

  applicable(domain: DataDomain, fromVersion: number): DataMigrationDefinition[] {
    return this.migrations.filter((m) => m.domain === domain && m.fromVersion === fromVersion);
  }

  migrate(
    domain: DataDomain,
    data: Record<string, unknown>,
    fromVersion: number,
  ): { data: Record<string, unknown>; toVersion: number; applied: string[] } {
    let working = data;
    let version = fromVersion;
    const applied: string[] = [];

    for (let hop = 0; hop < 100; hop += 1) {
      const next = this.migrations.find((m) => m.domain === domain && m.fromVersion === version);
      if (!next) break;
      working = next.migrate(working);
      version = next.toVersion;
      applied.push(next.id);
    }

    return { data: working, toVersion: version, applied };
  }
}
