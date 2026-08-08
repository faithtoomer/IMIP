import { describe, expect, it, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createConfigurationMigrationExecutor,
  createDataAuthorityMigrationExecutor,
  withResilienceRollback,
} from '../src/migrationExecutors.js';
import { ConfigurationAuthority } from '../../configuration_authority/src/index.js';
import { DataAuthority } from '../../data_authority/src/index.js';
import { ResilienceAuthority } from '../../resilience_authority/src/index.js';
import { makeTempRoot, cleanupTempRoot } from './testHelpers.js';
import type { MigrationPlan } from '../src/types.js';

function makePlan(overrides: Partial<MigrationPlan> = {}): MigrationPlan {
  return {
    migrationId: 'm1',
    artifactType: 'configuration-schema',
    sourceVersion: 'x',
    targetVersion: 'y',
    scope: 'all',
    preconditions: [],
    verificationRequirements: [],
    rollbackStrategy: 'snapshot-rollback',
    ...overrides,
  };
}

describe('Migration executors (§5/Law 1 — real orchestration over ICMS/IDA/IBRRA)', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('createConfigurationMigrationExecutor: execute() triggers a real reload(); verify() checks the real post-migration schema version', async () => {
    const configurationAuthority = new ConfigurationAuthority({ argv: [], env: {} });
    configurationAuthority.load();
    const executor = createConfigurationMigrationExecutor(configurationAuthority);
    const targetVersion = configurationAuthority.getVersionInfo().schemaVersion;
    const plan = makePlan({ targetVersion });

    const executeResult = await executor.execute(plan);
    expect(executeResult.success).toBe(true);

    const verifyResult = await executor.verify(plan);
    expect(verifyResult.valid).toBe(true);
  });

  it('createConfigurationMigrationExecutor: rollback() reverts to the exact pre-migration snapshot version', async () => {
    const configurationAuthority = new ConfigurationAuthority({ argv: [], env: {} });
    configurationAuthority.load();
    const preSnapshotVersion = configurationAuthority.getSnapshot().version;

    const executor = createConfigurationMigrationExecutor(configurationAuthority);
    const plan = makePlan();

    await executor.execute(plan);
    expect(configurationAuthority.getSnapshot().version).not.toBe(preSnapshotVersion);

    const rollbackResult = await executor.rollback(plan);
    expect(rollbackResult.success).toBe(true);
    expect(configurationAuthority.getSnapshot().version).toBe(preSnapshotVersion);
  });

  it('createConfigurationMigrationExecutor: rollback() without a prior execute() honestly fails', async () => {
    const configurationAuthority = new ConfigurationAuthority({ argv: [], env: {} });
    configurationAuthority.load();
    const executor = createConfigurationMigrationExecutor(configurationAuthority);
    const result = await executor.rollback(makePlan({ migrationId: 'never-executed' }));
    expect(result.success).toBe(false);
  });

  it('createDataAuthorityMigrationExecutor: execute() triggers IDA\'s real migration-on-read', async () => {
    const path = join(tmpdir(), `imip-ivgma-migration-${Date.now()}.db`);
    try {
      const writer = new DataAuthority({ filePath: path });
      writer.registerDomainSchema({ domain: 'notifications', version: 1, fields: [{ name: 'legacyMessage', type: 'string' }] });
      writer.create('notifications', { legacyMessage: 'hi' }, 'X');
      writer.close();

      const migration = {
        id: 'legacy-to-message',
        domain: 'notifications' as const,
        fromVersion: 1,
        toVersion: 2,
        description: 'renamed field',
        migrate: (data: Record<string, unknown>) => {
          const { legacyMessage, ...rest } = data;
          return { ...rest, message: legacyMessage };
        },
      };
      const reader = new DataAuthority({ filePath: path, migrations: [migration] });
      reader.registerDomainSchema({ domain: 'notifications', version: 2, fields: [{ name: 'message', type: 'string' }] });

      const executor = createDataAuthorityMigrationExecutor(reader);
      const plan = makePlan({ artifactType: 'database-schema', sourceVersion: '1', targetVersion: '2', scope: 'notifications' });

      const executeResult = await executor.execute(plan);
      expect(executeResult.success).toBe(true);

      const verifyResult = await executor.verify(plan);
      expect(verifyResult.valid).toBe(true);

      reader.close();
    } finally {
      if (existsSync(path)) unlinkSync(path);
    }
  });

  it('createDataAuthorityMigrationExecutor: rollback() is honestly unsupported without composition', async () => {
    const dataAuthority = new DataAuthority();
    dataAuthority.registerDomainSchema({ domain: 'benchmark-results', version: 1, fields: [] });
    const executor = createDataAuthorityMigrationExecutor(dataAuthority);
    const result = await executor.rollback(makePlan({ artifactType: 'database-schema', scope: 'benchmark-results' }));
    expect(result.success).toBe(false);
    dataAuthority.close();
  });

  it('withResilienceRollback composes a real IBRRA recovery for database rollback', async () => {
    root = makeTempRoot();
    const dataAuthority = new DataAuthority();
    dataAuthority.registerDomainSchema({ domain: 'benchmark-results', version: 1, fields: [{ name: 'name', type: 'string' }] });
    dataAuthority.create('benchmark-results', { name: 'gpu-1' }, 'X');

    const ibrra = new ResilienceAuthority({ backupRootPath: root, dataAuthority });
    const backup = await ibrra.createBackup({ backupType: 'full', domains: ['database'] });
    expect(backup.status).toBe('available');

    dataAuthority.create('benchmark-results', { name: 'gpu-2' }, 'X'); // diverge after backup

    const baseExecutor = createDataAuthorityMigrationExecutor(dataAuthority);
    const executor = withResilienceRollback(baseExecutor, ibrra, backup.backupId);
    const plan = makePlan({ artifactType: 'database-schema', scope: 'benchmark-results', rollbackStrategy: 'ibrra-recovery' });

    const result = await executor.rollback(plan);
    expect(result.success).toBe(true);

    const names = dataAuthority.find('benchmark-results', {}).map((r) => r.data.name);
    expect(names).toContain('gpu-1');
    expect(names).not.toContain('gpu-2');

    dataAuthority.close();
  });
});
