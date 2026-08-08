import { describe, expect, it } from 'vitest';
import { VersionGovernanceAuthority } from '../src/VersionGovernanceAuthority.js';
import type { MigrationExecutor } from '../src/types.js';

function makeExecutor(artifactType: string): MigrationExecutor {
  return {
    artifactType,
    execute: async () => ({ success: true }),
    verify: async () => ({ valid: true, reasons: [] }),
    rollback: async () => ({ success: true }),
  };
}

describe('performance smoke tests', () => {
  it('registers 50 versions and certifies 25 migrations well under 2s', async () => {
    const ivgma = new VersionGovernanceAuthority();
    ivgma.registerMigrationExecutor(makeExecutor('test-artifact'));

    const start = performance.now();

    for (let i = 0; i < 50; i += 1) {
      const record = ivgma.registerVersion({
        artifactType: 'database-schema',
        artifactName: `perf-${i}`,
        semanticVersion: '1.0.0',
        ownerAuthority: 'Test',
      });
      expect(record.status).toBe('registered');
    }

    for (let i = 0; i < 25; i += 1) {
      const from = `${i}.0.0`;
      const to = `${i + 1}.0.0`;
      ivgma.recordCompatibility('test-artifact', from, 'test-artifact', to, true);
      const migration = await ivgma.requestMigration(
        {
          artifactType: 'test-artifact',
          sourceVersion: from,
          targetVersion: to,
          scope: 'all',
          preconditions: [],
          verificationRequirements: [],
          rollbackStrategy: 'x',
        },
        'Operator',
      );
      expect(migration.status).toBe('certified');
    }

    expect(performance.now() - start).toBeLessThan(2000);
    expect(ivgma.getMetrics().migrationCount).toBe(25);
  });
});
