import { describe, expect, it, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { ResilienceAuthority } from '../src/ResilienceAuthority.js';
import { createJsonDomainHandler } from '../src/handlers.js';
import { DataAuthority } from '../../data_authority/src/index.js';
import { ConfigurationAuthority } from '../../configuration_authority/src/index.js';
import { StorageAuthority } from '../../storage_authority/src/index.js';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import {
  NoBackupDestinationError,
  NoDomainHandlersError,
  UnregisteredBackupDomainError,
  UnsupportedBackupTypeError,
} from '../src/errors.js';
import { makeTempRoot, cleanupTempRoot } from './testHelpers.js';

describe('ResilienceAuthority (Law 1/Law 2/Law 5/Law 6 — the sole resilience authority)', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('createBackup() with incremental/differential throws — no such primitive exists in IDA/ISMA', async () => {
    root = makeTempRoot();
    const ibrra = new ResilienceAuthority({ backupRootPath: root });
    await expect(ibrra.createBackup({ backupType: 'incremental' })).rejects.toThrow(UnsupportedBackupTypeError);
  });

  it('createBackup() throws with no configured destination', async () => {
    const ibrra = new ResilienceAuthority();
    // plugin-registry/capability-registry noop handlers always exist, so this exercises the destination check, not "no handlers".
    await expect(ibrra.createBackup({ backupType: 'manual', domains: ['plugin-registry'] })).rejects.toThrow(NoBackupDestinationError);
  });

  it('createBackup() throws for an unregistered domain', async () => {
    root = makeTempRoot();
    const ibrra = new ResilienceAuthority({ backupRootPath: root });
    await expect(ibrra.createBackup({ backupType: 'manual', domains: ['not-a-real-domain'] })).rejects.toThrow(UnregisteredBackupDomainError);
  });

  it('createBackup() with a real handler reaches "available" and registers a recovery point', async () => {
    root = makeTempRoot();
    const ibrra = new ResilienceAuthority({ backupRootPath: root });
    ibrra.registerDomainHandler(createJsonDomainHandler('custom', () => ({ x: 1 })));

    const record = await ibrra.createBackup({ backupType: 'manual', domains: ['custom'] });
    expect(record.status).toBe('available');
    expect(record.verificationStatus).toBe('verified');
    expect(ibrra.graph.all()).toHaveLength(1);
  });

  it('a domain handler that throws during backup() ends the whole backup in "failed", not a crash', async () => {
    root = makeTempRoot();
    const ibrra = new ResilienceAuthority({ backupRootPath: root });
    ibrra.registerDomainHandler({
      domain: 'broken',
      backup: async () => {
        throw new Error('disk full');
      },
      validate: async () => ({ domain: 'broken', valid: false, reasons: [] }),
      restore: async () => ({ domain: 'broken', success: false, supported: true }),
    });

    const record = await ibrra.createBackup({ backupType: 'manual', domains: ['broken'] });
    expect(record.status).toBe('failed');
    expect(ibrra.getMetrics().backupFailureCount).toBe(1);
  });

  it('verifyBackup() re-detects corruption introduced after the initial backup', async () => {
    root = makeTempRoot();
    const ibrra = new ResilienceAuthority({ backupRootPath: root });
    ibrra.registerDomainHandler(createJsonDomainHandler('custom', () => ({ x: 1 })));
    const record = await ibrra.createBackup({ backupType: 'manual', domains: ['custom'] });

    writeFileSync(record.domains[0].location, Buffer.from('tampered'));
    const reverified = await ibrra.verifyBackup(record.backupId);
    expect(reverified.verificationStatus).toBe('failed');
  });

  it('requestRecovery() refuses an unverified backup — Law 2 "Recoverability First"', async () => {
    root = makeTempRoot();
    const ibrra = new ResilienceAuthority({ backupRootPath: root });
    ibrra.registerDomainHandler({
      domain: 'broken',
      backup: async () => {
        throw new Error('x');
      },
      validate: async () => ({ domain: 'broken', valid: false, reasons: [] }),
      restore: async () => ({ domain: 'broken', success: false, supported: true }),
    });
    const backup = await ibrra.createBackup({ backupType: 'manual', domains: ['broken'] });

    const recovery = await ibrra.requestRecovery(backup.backupId, 'Operator', 'test');
    expect(recovery.status).toBe('failed');
    expect(recovery.steps.at(-1)?.detail).toMatch(/not verified/i);
  });

  it('requestRecovery() end-to-end: real restoreFn is called and the recovery reaches "operational"', async () => {
    root = makeTempRoot();
    const ibrra = new ResilienceAuthority({ backupRootPath: root });
    let restoredValue: unknown;
    ibrra.registerDomainHandler(
      createJsonDomainHandler(
        'custom',
        () => ({ x: 42 }),
        (data) => {
          restoredValue = data;
        },
      ),
    );

    const backup = await ibrra.createBackup({ backupType: 'manual', domains: ['custom'] });
    expect(backup.verificationStatus).toBe('verified');

    const recovery = await ibrra.requestRecovery(backup.backupId, 'Operator', 'disaster drill');
    expect(recovery.status).toBe('operational');
    expect(restoredValue).toEqual({ x: 42 });
    expect(recovery.domainResults.every((r) => r.success)).toBe(true);
  });

  it('a real end-to-end IDA backup and recovery round-trip', async () => {
    root = makeTempRoot();
    const ida = new DataAuthority();
    ida.registerDomainSchema({ domain: 'benchmark-results', version: 1, fields: [{ name: 'name', type: 'string', required: true }] });
    ida.create('benchmark-results', { name: 'gpu-1' }, 'X');

    const ibrra = new ResilienceAuthority({ backupRootPath: root, dataAuthority: ida });
    const backup = await ibrra.createBackup({ backupType: 'full', domains: ['database'] });
    expect(backup.status).toBe('available');

    ida.create('benchmark-results', { name: 'gpu-2' }, 'X'); // diverge after backup

    const recovery = await ibrra.requestRecovery(backup.backupId, 'Operator', 'restore drill');
    expect(recovery.status).toBe('operational');

    const names = ida.find('benchmark-results', {}).map((r) => r.data.name);
    expect(names).toContain('gpu-1');
    expect(names).not.toContain('gpu-2'); // restored to the pre-divergence state

    ida.close();
  });

  it('requestRecovery() fails on a real platform-version mismatch', async () => {
    root = makeTempRoot();
    const configurationAuthority = new ConfigurationAuthority({ argv: [], env: {} });
    configurationAuthority.load();

    const ibrra = new ResilienceAuthority({ backupRootPath: root, configurationAuthority });
    ibrra.registerDomainHandler(createJsonDomainHandler('custom', () => ({ x: 1 })));
    const backup = await ibrra.createBackup({ backupType: 'manual', domains: ['custom'] });

    // Simulate the platform having since upgraded past the backup's recorded version.
    const stale = ibrra.registry.require(backup.backupId);
    ibrra.registry.update({ ...stale, recoveryCompatibilityVersion: '0.0.1-different' });

    const recovery = await ibrra.requestRecovery(backup.backupId, 'Operator', 'test');
    expect(recovery.status).toBe('failed');
    expect(recovery.steps.some((s) => s.detail?.includes('Version mismatch'))).toBe(true);
  });

  it('wires into a real StorageAuthority for real backup file allocation', async () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    const ibrra = new ResilienceAuthority({ storageAuthority: isma });
    ibrra.registerDomainHandler(createJsonDomainHandler('custom', () => ({ x: 1 })));

    const record = await ibrra.createBackup({ backupType: 'manual', domains: ['custom'] });
    expect(record.status).toBe('available');
    expect(isma.registry.all().some((entry) => entry.domain === 'backups')).toBe(true);
  });

  it('getMetrics() computes a real recoveryReadinessScore from verified/total backups', async () => {
    root = makeTempRoot();
    const ibrra = new ResilienceAuthority({ backupRootPath: root });
    ibrra.registerDomainHandler(createJsonDomainHandler('custom', () => ({ x: 1 })));
    await ibrra.createBackup({ backupType: 'manual', domains: ['custom'] });
    expect(ibrra.getMetrics().recoveryReadinessScore).toBe(100);
  });

  it('explainBackup() surfaces the record and its full transition history', async () => {
    root = makeTempRoot();
    const ibrra = new ResilienceAuthority({ backupRootPath: root });
    ibrra.registerDomainHandler(createJsonDomainHandler('custom', () => ({ x: 1 })));
    const record = await ibrra.createBackup({ backupType: 'manual', domains: ['custom'] });
    const view = ibrra.explainBackup(record.backupId);
    expect(view.record.backupId).toBe(record.backupId);
    expect(view.history.length).toBeGreaterThan(1);
  });

  // ---- Real IEB / IOLA integration ----

  it('wires into a real InstitutionalEventBus under the additive "resilience" category', async () => {
    root = makeTempRoot();
    const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const ibrra = new ResilienceAuthority({ backupRootPath: root, eventBus: bus });
    ibrra.registerDomainHandler(createJsonDomainHandler('custom', () => ({ x: 1 })));

    const seen: unknown[] = [];
    bus.subscribeToEvent('BackupStarted', (envelope) => { seen.push(envelope.payload); }, { subscriberAuthority: 'Test' });

    await ibrra.createBackup({ backupType: 'manual', domains: ['custom'] });
    await ibrra.events.flushMirror();

    expect(seen).toHaveLength(1);
    expect(bus.getEventDefinition('BackupStarted')?.category).toBe('resilience');
  });

  it('wires into a real ObservabilityAuthority: resilience events are logged under category "resilience"', async () => {
    root = makeTempRoot();
    const iola = new ObservabilityAuthority();
    const ibrra = new ResilienceAuthority({ backupRootPath: root, observabilityAuthority: iola });
    ibrra.registerDomainHandler(createJsonDomainHandler('custom', () => ({ x: 1 })));

    await ibrra.createBackup({ backupType: 'manual', domains: ['custom'] });
    const logged = iola.search((record) => record.category === 'resilience' && record.operation === 'BackupStarted');
    expect(logged).toHaveLength(1);
  });
});
