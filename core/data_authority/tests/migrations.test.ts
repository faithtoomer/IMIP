import { describe, expect, it } from 'vitest';
import { DataMigrationRunner } from '../src/migrations.js';
import type { DataMigrationDefinition } from '../src/types.js';

describe('DataMigrationRunner (§10)', () => {
  it('applies a single migration', () => {
    const migration: DataMigrationDefinition = {
      id: 'rename-field',
      domain: 'telemetry',
      fromVersion: 1,
      toVersion: 2,
      description: 'legacy -> current',
      migrate: (data) => {
        const { legacy, ...rest } = data;
        return { ...rest, current: legacy };
      },
    };
    const runner = new DataMigrationRunner([migration]);
    const result = runner.migrate('telemetry', { legacy: 'value' }, 1);
    expect(result.data).toEqual({ current: 'value' });
    expect(result.toVersion).toBe(2);
    expect(result.applied).toEqual(['rename-field']);
  });

  it('chains multiple migrations', () => {
    const migrations: DataMigrationDefinition[] = [
      { id: 'v1-v2', domain: 'telemetry', fromVersion: 1, toVersion: 2, description: 'step1', migrate: (d) => ({ ...d, step1: true }) },
      { id: 'v2-v3', domain: 'telemetry', fromVersion: 2, toVersion: 3, description: 'step2', migrate: (d) => ({ ...d, step2: true }) },
    ];
    const runner = new DataMigrationRunner(migrations);
    const result = runner.migrate('telemetry', {}, 1);
    expect(result.data).toEqual({ step1: true, step2: true });
    expect(result.toVersion).toBe(3);
    expect(result.applied).toEqual(['v1-v2', 'v2-v3']);
  });

  it('is a no-op when no migration applies', () => {
    const runner = new DataMigrationRunner([]);
    const result = runner.migrate('telemetry', { a: 1 }, 5);
    expect(result.data).toEqual({ a: 1 });
    expect(result.applied).toEqual([]);
    expect(result.toVersion).toBe(5);
  });

  it('only applies migrations for the matching domain', () => {
    const migration: DataMigrationDefinition = {
      id: 'other-domain',
      domain: 'notifications',
      fromVersion: 1,
      toVersion: 2,
      description: 'irrelevant',
      migrate: (d) => ({ ...d, touched: true }),
    };
    const runner = new DataMigrationRunner([migration]);
    const result = runner.migrate('telemetry', { a: 1 }, 1);
    expect(result.data).toEqual({ a: 1 });
    expect(result.applied).toEqual([]);
  });
});
