import { describe, expect, it } from 'vitest';
import { VersionGovernanceAuthority } from '../src/VersionGovernanceAuthority.js';
import { createConfigurationVersionSource, createDatabaseVersionSource } from '../src/versionSources.js';
import { NoMigrationExecutorError, UnregisteredArtifactTypeError } from '../src/errors.js';
import { ConfigurationAuthority } from '../../configuration_authority/src/index.js';
import { DataAuthority } from '../../data_authority/src/index.js';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import type { MigrationExecutionResult, MigrationExecutor, MigrationRequest, MigrationVerificationResult } from '../src/types.js';

function makeExecutor(
  artifactType: string,
  overrides: Partial<{
    execute: () => Promise<MigrationExecutionResult>;
    verify: () => Promise<MigrationVerificationResult>;
    rollback: () => Promise<MigrationExecutionResult>;
  }> = {},
): MigrationExecutor {
  return {
    artifactType,
    execute: overrides.execute ?? (async () => ({ success: true })),
    verify: overrides.verify ?? (async () => ({ valid: true, reasons: [] })),
    rollback: overrides.rollback ?? (async () => ({ success: true })),
  };
}

function makeRequest(overrides: Partial<MigrationRequest> = {}): MigrationRequest {
  return {
    artifactType: 'test-artifact',
    sourceVersion: '1.0.0',
    targetVersion: '2.0.0',
    scope: 'all',
    preconditions: [],
    verificationRequirements: [],
    rollbackStrategy: 'x',
    ...overrides,
  };
}

describe('VersionGovernanceAuthority (Program II, Phase 15 — IVGMA, the sole version governance/migration authority)', () => {
  it('registerVersion() auto-transitions created -> registered', () => {
    const ivgma = new VersionGovernanceAuthority();
    const record = ivgma.registerVersion({ artifactType: 'database-schema', artifactName: 'x', semanticVersion: '1.0.0', ownerAuthority: 'Test' });
    expect(record.status).toBe('registered');
  });

  it('registerVersion() throws for an unregistered artifact type', () => {
    const ivgma = new VersionGovernanceAuthority();
    expect(() =>
      ivgma.registerVersion({ artifactType: 'totally-unknown', artifactName: 'x', semanticVersion: '1.0.0', ownerAuthority: 'Test' }),
    ).toThrow(UnregisteredArtifactTypeError);
  });

  it('syncVersions() pulls real ICMS/IDA version data and does not duplicate on repeat calls', () => {
    const configurationAuthority = new ConfigurationAuthority({ argv: [], env: {} });
    configurationAuthority.load();
    const dataAuthority = new DataAuthority();
    dataAuthority.registerDomainSchema({ domain: 'benchmark-results', version: 1, fields: [] });

    const ivgma = new VersionGovernanceAuthority({
      versionSources: [createConfigurationVersionSource(configurationAuthority), createDatabaseVersionSource(dataAuthority)],
    });

    const first = ivgma.syncVersions('Test');
    expect(first.length).toBeGreaterThanOrEqual(2);
    expect(first.every((record) => record.status === 'registered')).toBe(true);

    const second = ivgma.syncVersions('Test');
    expect(second).toHaveLength(0);

    dataAuthority.close();
  });

  it('full version lifecycle: registered -> certified -> released -> supported -> deprecated -> retired', () => {
    const ivgma = new VersionGovernanceAuthority();
    const registered = ivgma.registerVersion({ artifactType: 'database-schema', artifactName: 'lifecycle', semanticVersion: '1.0.0', ownerAuthority: 'Test' });

    const certified = ivgma.certifyVersion(registered.versionId, true);
    expect(certified.status).toBe('certified');
    expect(certified.certificationStatus).toBe('certified');

    const released = ivgma.releaseVersion(registered.versionId);
    expect(released.status).toBe('released');

    const supported = ivgma.markSupported(registered.versionId);
    expect(supported.status).toBe('supported');

    const deprecated = ivgma.deprecateVersion(registered.versionId, { replacementArtifact: 'lifecycle@2.0.0' });
    expect(deprecated.status).toBe('deprecated');
    expect(deprecated.deprecation?.replacementArtifact).toBe('lifecycle@2.0.0');

    const retired = ivgma.retireVersion(registered.versionId);
    expect(retired.status).toBe('retired');
  });

  it('certifyVersion(false) transitions to the honest terminal "rejected" state', () => {
    const ivgma = new VersionGovernanceAuthority();
    const registered = ivgma.registerVersion({ artifactType: 'database-schema', artifactName: 'reject-me', semanticVersion: '1.0.0', ownerAuthority: 'Test' });
    const rejected = ivgma.certifyVersion(registered.versionId, false);
    expect(rejected.status).toBe('rejected');
    expect(rejected.certificationStatus).toBe('rejected');
  });

  it('recordCompatibility() records a real relationship and publishes CompatibilityVerified', () => {
    const ivgma = new VersionGovernanceAuthority();
    const seen: unknown[] = [];
    ivgma.events.subscribe('CompatibilityVerified', (payload) => seen.push(payload));
    const relationship = ivgma.recordCompatibility('test-artifact', '1.0.0', 'test-artifact', '2.0.0', true, 'additive change');
    expect(relationship.compatible).toBe(true);
    expect(seen).toHaveLength(1);
  });

  it('planMigration() throws for an unregistered artifact type', () => {
    const ivgma = new VersionGovernanceAuthority();
    expect(() => ivgma.planMigration(makeRequest({ artifactType: 'totally-unknown' }), 'Operator')).toThrow(UnregisteredArtifactTypeError);
  });

  it('executeMigration() throws when no executor is registered for the artifact type', async () => {
    const ivgma = new VersionGovernanceAuthority();
    const plan = ivgma.planMigration(makeRequest({ artifactType: 'database-schema' }), 'Operator');
    await expect(ivgma.executeMigration(plan.migrationId)).rejects.toThrow(NoMigrationExecutorError);
  });

  it('requestMigration() happy path reaches "certified" through the full pipeline', async () => {
    const ivgma = new VersionGovernanceAuthority();
    ivgma.registerMigrationExecutor(makeExecutor('test-artifact'));
    ivgma.recordCompatibility('test-artifact', '1.0.0', 'test-artifact', '2.0.0', true, 'additive');

    const record = await ivgma.requestMigration(makeRequest(), 'Operator');
    expect(record.status).toBe('certified');
    expect(record.completedAt).toBeDefined();
  });

  it('Law 3 fail-closed: no recorded verified-compatible relationship routes to rollback, not an assumed pass', async () => {
    const ivgma = new VersionGovernanceAuthority();
    ivgma.registerMigrationExecutor(makeExecutor('test-artifact'));

    const record = await ivgma.requestMigration(makeRequest(), 'Operator');
    expect(record.status).toBe('rolled-back');
    expect(record.steps.some((step) => /law 3/i.test(step.detail ?? ''))).toBe(true);
  });

  it('a failing execute() routes to rollback', async () => {
    const ivgma = new VersionGovernanceAuthority();
    ivgma.registerMigrationExecutor(makeExecutor('test-artifact', { execute: async () => ({ success: false, message: 'disk full' }) }));
    ivgma.recordCompatibility('test-artifact', '1.0.0', 'test-artifact', '2.0.0', true);

    const record = await ivgma.requestMigration(makeRequest(), 'Operator');
    expect(record.status).toBe('rolled-back');
    expect(record.steps.some((step) => step.detail === 'disk full')).toBe(true);
  });

  it('a failing verify() routes to rollback', async () => {
    const ivgma = new VersionGovernanceAuthority();
    ivgma.registerMigrationExecutor(makeExecutor('test-artifact', { verify: async () => ({ valid: false, reasons: ['checksum mismatch'] }) }));
    ivgma.recordCompatibility('test-artifact', '1.0.0', 'test-artifact', '2.0.0', true);

    const record = await ivgma.requestMigration(makeRequest(), 'Operator');
    expect(record.status).toBe('rolled-back');
    expect(record.steps.some((step) => step.detail === 'checksum mismatch')).toBe(true);
  });

  it('when rollback itself fails, the migration honestly ends in "failed", not "rolled-back"', async () => {
    const ivgma = new VersionGovernanceAuthority();
    ivgma.registerMigrationExecutor(
      makeExecutor('test-artifact', {
        execute: async () => ({ success: false, message: 'boom' }),
        rollback: async () => ({ success: false, message: 'rollback also failed' }),
      }),
    );
    ivgma.recordCompatibility('test-artifact', '1.0.0', 'test-artifact', '2.0.0', true);

    const record = await ivgma.requestMigration(makeRequest(), 'Operator');
    expect(record.status).toBe('failed');
  });

  it('explainVersion() returns the record plus its full audit history', () => {
    const ivgma = new VersionGovernanceAuthority();
    const registered = ivgma.registerVersion({ artifactType: 'database-schema', artifactName: 'explain-me', semanticVersion: '1.0.0', ownerAuthority: 'Test' });
    ivgma.certifyVersion(registered.versionId, true);
    const view = ivgma.explainVersion(registered.versionId);
    expect(view.record.status).toBe('certified');
    expect(view.history.length).toBeGreaterThanOrEqual(2);
  });

  it('explainMigration() returns the current migration record', async () => {
    const ivgma = new VersionGovernanceAuthority();
    ivgma.registerMigrationExecutor(makeExecutor('test-artifact'));
    ivgma.recordCompatibility('test-artifact', '1.0.0', 'test-artifact', '2.0.0', true);
    const record = await ivgma.requestMigration(makeRequest(), 'Operator');
    const view = ivgma.explainMigration(record.migrationId);
    expect(view.migrationId).toBe(record.migrationId);
    expect(view.status).toBe('certified');
  });

  it('getMetrics() reflects real migration/rollback counts', async () => {
    const ivgma = new VersionGovernanceAuthority();

    ivgma.registerMigrationExecutor(makeExecutor('test-artifact'));
    ivgma.recordCompatibility('test-artifact', '1.0.0', 'test-artifact', '2.0.0', true);
    await ivgma.requestMigration(makeRequest(), 'Operator');

    ivgma.registerMigrationExecutor(makeExecutor('test-artifact', { execute: async () => ({ success: false, message: 'boom' }) }));
    ivgma.recordCompatibility('test-artifact', '2.0.0', 'test-artifact', '3.0.0', true);
    await ivgma.requestMigration(makeRequest({ sourceVersion: '2.0.0', targetVersion: '3.0.0' }), 'Operator');

    const metrics = ivgma.getMetrics();
    expect(metrics.migrationCount).toBe(1);
    expect(metrics.migrationFailureCount).toBe(1);
    expect(metrics.rollbackCount).toBe(1);
  });

  // ---- Real IEB / IOLA integration ----

  it('wires into a real InstitutionalEventBus under the additive "version-governance" category', async () => {
    const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const ivgma = new VersionGovernanceAuthority({ eventBus: bus });

    const seen: unknown[] = [];
    bus.subscribeToEvent('VersionRegistered', (envelope) => { seen.push(envelope.payload); }, { subscriberAuthority: 'Test' });

    ivgma.registerVersion({ artifactType: 'database-schema', artifactName: 'x', semanticVersion: '1.0.0', ownerAuthority: 'Test' });
    await ivgma.events.flushMirror();

    expect(seen).toHaveLength(1);
    expect(bus.getEventDefinition('VersionRegistered')?.category).toBe('version-governance');
  });

  it('wires into a real ObservabilityAuthority: version-governance events are logged under category "version-governance"', () => {
    const iola = new ObservabilityAuthority();
    const ivgma = new VersionGovernanceAuthority({ observabilityAuthority: iola });

    ivgma.registerVersion({ artifactType: 'database-schema', artifactName: 'x', semanticVersion: '1.0.0', ownerAuthority: 'Test' });
    const logged = iola.search((record) => record.category === 'version-governance' && record.operation === 'VersionRegistered');
    expect(logged).toHaveLength(1);
  });
});
