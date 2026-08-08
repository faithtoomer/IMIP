import type { ConfigurationAuthority } from '../../configuration_authority/src/index.js';
import type { DataAuthority, DataDomain } from '../../data_authority/src/index.js';
import type { ResilienceAuthority } from '../../resilience_authority/src/index.js';
import type { MigrationExecutionResult, MigrationExecutor, MigrationPlan, MigrationVerificationResult } from './types.js';

/**
 * §5/Law 1 — wraps ICMS's real, already-existing `reload()` (which
 * internally runs ICMS's own real `MigrationRunner`, Phase 02) and real
 * `rollback()` (backed by ICMS's immutable `SnapshotStore`). IVGMA never
 * reimplements configuration migration or snapshot rollback. Rollback
 * targets the exact snapshot version captured immediately before this
 * migration's `execute()` ran — not a guess derived from a schema-version
 * string, which ICMS's `rollback()` doesn't accept anyway (it takes a
 * snapshot version number). See ADR-0018.
 */
export function createConfigurationMigrationExecutor(configurationAuthority: ConfigurationAuthority): MigrationExecutor {
  const preMigrationSnapshotVersion = new Map<string, number>();

  return {
    artifactType: 'configuration-schema',

    async execute(plan: MigrationPlan): Promise<MigrationExecutionResult> {
      const current = configurationAuthority.getSnapshot();
      preMigrationSnapshotVersion.set(plan.migrationId, current.version);
      try {
        configurationAuthority.reload();
        return { success: true };
      } catch (error) {
        return { success: false, message: (error as Error).message };
      }
    },

    async verify(plan: MigrationPlan): Promise<MigrationVerificationResult> {
      const info = configurationAuthority.getVersionInfo();
      const matches = info.schemaVersion === plan.targetVersion;
      return {
        valid: matches,
        reasons: matches ? [] : [`Post-migration schema version "${info.schemaVersion}" does not match target "${plan.targetVersion}".`],
      };
    },

    async rollback(plan: MigrationPlan): Promise<MigrationExecutionResult> {
      const priorVersion = preMigrationSnapshotVersion.get(plan.migrationId);
      if (priorVersion === undefined) {
        return { success: false, message: 'No pre-migration snapshot was recorded to roll back to.' };
      }
      try {
        configurationAuthority.rollback(priorVersion, `Rollback of migration "${plan.migrationId}"`, 'IVGMA');
        return { success: true };
      } catch (error) {
        return { success: false, message: (error as Error).message };
      }
    },
  };
}

/**
 * §5/Law 1 — wraps IDA's real, already-existing migration-on-read (Phase
 * 08). `execute()` calls the domain's real `find()`, which transparently
 * applies and persists any pending `DataMigrationDefinition` across every
 * record in the domain — IVGMA never reimplements record migration.
 * `rollback()` is honestly unsupported here: IDA has no in-place migration
 * undo. Compose with `withResilienceRollback()` for a real, IBRRA-backed
 * rollback when a pre-migration backup exists.
 */
export function createDataAuthorityMigrationExecutor(dataAuthority: DataAuthority): MigrationExecutor {
  return {
    artifactType: 'database-schema',

    async execute(plan: MigrationPlan): Promise<MigrationExecutionResult> {
      try {
        dataAuthority.find(plan.scope as DataDomain, {});
        return { success: true };
      } catch (error) {
        return { success: false, message: (error as Error).message };
      }
    },

    async verify(plan: MigrationPlan): Promise<MigrationVerificationResult> {
      try {
        const schema = dataAuthority.schemas.get(plan.scope as DataDomain);
        const matches = String(schema.version) === plan.targetVersion;
        return {
          valid: matches,
          reasons: matches ? [] : [`Domain "${plan.scope}" schema version "${schema.version}" does not match target "${plan.targetVersion}".`],
        };
      } catch (error) {
        return { valid: false, reasons: [(error as Error).message] };
      }
    },

    async rollback(): Promise<MigrationExecutionResult> {
      return {
        success: false,
        message: 'Database rollback requires a pre-migration backup — see withResilienceRollback().',
      };
    },
  };
}

/** A real, composable rollback upgrade: delegates to IBRRA's actual
 * `requestRecovery()` (Phase 14) instead of leaving rollback unsupported.
 * Not baked into `createDataAuthorityMigrationExecutor()` directly, since
 * requiring a `ResilienceAuthority` + a specific pre-migration `backupId`
 * is a real, situational choice the caller makes, not something IVGMA can
 * assume. */
export function withResilienceRollback(executor: MigrationExecutor, resilienceAuthority: ResilienceAuthority, backupId: string): MigrationExecutor {
  return {
    artifactType: executor.artifactType,
    execute: executor.execute,
    verify: executor.verify,
    async rollback(plan: MigrationPlan): Promise<MigrationExecutionResult> {
      try {
        const recovery = await resilienceAuthority.requestRecovery(backupId, 'IVGMA', `Rollback of migration "${plan.migrationId}"`);
        return recovery.status === 'operational'
          ? { success: true }
          : { success: false, message: `Recovery ended in status "${recovery.status}".` };
      } catch (error) {
        return { success: false, message: (error as Error).message };
      }
    },
  };
}
