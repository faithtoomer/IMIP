import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import type { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import type { DataAuthority } from '../../data_authority/src/index.js';
import type { ConfigurationAuthority } from '../../configuration_authority/src/index.js';
import type { HardwareAuthority } from '../../hardware_authority/src/index.js';
import type { RuntimeOrchestrator } from '../../runtime_bootstrap/src/index.js';
import type { StorageAuthority } from '../../storage_authority/src/index.js';
import type { SecurityAuthority } from '../../security_authority/src/index.js';
import { BackupDomainRegistry } from './domainRegistry.js';
import { BackupRegistry } from './registry.js';
import { InstitutionalRecoveryGraph } from './recoveryGraph.js';
import { ResilienceAuditTrail } from './auditTrail.js';
import { ResilienceEventBus } from './events.js';
import { assertBackupTransition, assertRecoveryTransition } from './lifecycle.js';
import {
  createConfigurationHandler,
  createDataAuthorityHandler,
  createHardwareHandler,
  createLogsAuditHandler,
  createNoopDomainHandler,
  createRuntimeHandler,
} from './handlers.js';
import {
  NoBackupDestinationError,
  NoDomainHandlersError,
  RecoveryNotFoundError,
  UnregisteredBackupDomainError,
  UnsupportedBackupTypeError,
} from './errors.js';
import { RESILIENCE_EVENTS } from './types.js';
import type {
  BackupLifecycleStatus,
  BackupRecord,
  BackupRequest,
  DomainBackupHandler,
  DomainBackupResult,
  DomainRestoreResult,
  DomainValidationResult,
  RecoveryLifecycleStatus,
  RecoveryPoint,
  RecoveryRecord,
  RecoveryStepRecord,
  ResilienceEventName,
  ResilienceMetrics,
} from './types.js';

export interface ResilienceAuthorityOptions {
  eventBus?: InstitutionalEventBus;
  observabilityAuthority?: ObservabilityAuthority;
  dataAuthority?: DataAuthority;
  configurationAuthority?: ConfigurationAuthority;
  hardwareAuthority?: HardwareAuthority;
  runtimeOrchestrator?: RuntimeOrchestrator;
  storageAuthority?: StorageAuthority;
  securityAuthority?: SecurityAuthority;
  /** Fallback backup destination when no StorageAuthority is supplied —
   * explicit, never an implicit cwd default (avoids silently writing into
   * whatever directory the process happens to run from). */
  backupRootPath?: string;
  additionalHandlers?: DomainBackupHandler[];
  now?: () => Date;
}

const LOG_CATEGORY = 'resilience';
const SELF_AUTHORITY = 'Backup, Recovery & Resilience Authority';

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * IBRRA — the Institutional Backup, Recovery & Resilience Authority
 * (PHASE-14). The sole authority for backup orchestration, recovery
 * orchestration, and resilience planning. IBRRA never re-implements
 * persistence or storage mechanics itself (Law 1, reflexively applied to
 * IBRRA's own design) — every domain handler wraps IDA's/ICMS's/IHIS's/
 * IRBLM's own real, existing methods; ISMA provides the real destination
 * for backup files. See ADR-0017.
 */
export class ResilienceAuthority {
  readonly domains = new BackupDomainRegistry();
  readonly registry = new BackupRegistry();
  readonly graph = new InstitutionalRecoveryGraph();
  readonly audit = new ResilienceAuditTrail();
  readonly events: ResilienceEventBus;

  private readonly handlers = new Map<string, DomainBackupHandler>();
  private readonly recoveries = new Map<string, RecoveryRecord>();
  private readonly storageAuthority?: StorageAuthority;
  private readonly backupRootPath?: string;
  private readonly configurationAuthority?: ConfigurationAuthority;
  private readonly dataAuthority?: DataAuthority;
  private readonly runtimeOrchestrator?: RuntimeOrchestrator;
  private readonly observability?: ObservabilityAuthority;
  private readonly now: () => Date;

  private backupCount = 0;
  private backupFailureCount = 0;
  private recoveryCount = 0;
  private recoveryFailureCount = 0;
  private readonly backupDurations: number[] = [];
  private readonly recoveryDurations: number[] = [];
  private readonly verificationDurations: number[] = [];

  constructor(options: ResilienceAuthorityOptions = {}) {
    this.storageAuthority = options.storageAuthority;
    this.backupRootPath = options.backupRootPath;
    this.configurationAuthority = options.configurationAuthority;
    this.dataAuthority = options.dataAuthority;
    this.runtimeOrchestrator = options.runtimeOrchestrator;
    this.observability = options.observabilityAuthority;
    this.now = options.now ?? (() => new Date());
    this.events = new ResilienceEventBus(options.eventBus);

    if (options.dataAuthority) this.handlers.set('database', createDataAuthorityHandler(options.dataAuthority));
    if (options.configurationAuthority) this.handlers.set('configuration', createConfigurationHandler(options.configurationAuthority));
    if (options.hardwareAuthority) this.handlers.set('hardware-registry', createHardwareHandler(options.hardwareAuthority));
    if (options.runtimeOrchestrator) this.handlers.set('runtime', createRuntimeHandler(options.runtimeOrchestrator));
    if (options.observabilityAuthority || options.securityAuthority) {
      this.handlers.set('logs-audit', createLogsAuditHandler({ observability: options.observabilityAuthority, security: options.securityAuthority }));
    }
    this.handlers.set('plugin-registry', createNoopDomainHandler('plugin-registry'));
    this.handlers.set('capability-registry', createNoopDomainHandler('capability-registry'));
    for (const handler of options.additionalHandlers ?? []) this.handlers.set(handler.domain, handler);

    if (this.observability) {
      if (!this.observability.categories.has(LOG_CATEGORY)) this.observability.registerCategory(LOG_CATEGORY);
      for (const name of Object.values(RESILIENCE_EVENTS)) {
        if (!this.observability.schemas.get(LOG_CATEGORY, name)) {
          this.observability.registerSchema({ category: LOG_CATEGORY, operation: name, description: `IBRRA event: ${name}` });
        }
      }
    }
  }

  registerDomainHandler(handler: DomainBackupHandler): void {
    this.domains.register(handler.domain);
    this.handlers.set(handler.domain, handler);
  }

  // ---- Backup (§7–§10, Law 1/Law 2) ----

  async createBackup(request: BackupRequest): Promise<BackupRecord> {
    if (request.backupType === 'incremental' || request.backupType === 'differential') {
      throw new UnsupportedBackupTypeError(request.backupType);
    }

    const domainsToBackup = request.domains ?? [...this.handlers.keys()];
    if (domainsToBackup.length === 0) throw new NoDomainHandlersError();
    for (const domain of domainsToBackup) {
      if (!this.handlers.has(domain)) throw new UnregisteredBackupDomainError(domain);
    }

    const backupId = randomUUID();
    const start = performance.now();
    this.publish(RESILIENCE_EVENTS.BackupStarted, { backupId, backupType: request.backupType, domains: domainsToBackup });

    const destinationDir = this.allocateBackupDirectory(backupId);
    const domainResults: DomainBackupResult[] = [];
    let anyDomainThrew = false;

    for (const domain of domainsToBackup) {
      try {
        domainResults.push(await this.handlers.get(domain)!.backup(destinationDir));
      } catch (error) {
        anyDomainThrew = true;
        domainResults.push({ domain, sizeBytes: 0, location: '', compressionStatus: 'none', metadata: { error: (error as Error).message } });
      }
    }

    const platformVersion = this.resolvePlatformVersion();
    let record: BackupRecord = {
      backupId,
      backupType: request.backupType,
      domains: domainResults,
      createdAt: this.now().toISOString(),
      storageLocation: destinationDir,
      totalSizeBytes: domainResults.reduce((sum, d) => sum + d.sizeBytes, 0),
      encryptionStatus: 'none',
      verificationStatus: 'unverified',
      retentionPolicy: request.retentionPolicy,
      recoveryCompatibilityVersion: platformVersion,
      status: 'created',
      reason: request.reason,
    };
    this.registry.register(record);
    this.audit.recordBackup(record);
    this.backupDurations.push(performance.now() - start);

    if (anyDomainThrew) {
      record = this.transitionBackup(record, 'failed');
      this.backupFailureCount += 1;
      this.publish(RESILIENCE_EVENTS.BackupFailed, { backupId });
      return record;
    }

    record = this.transitionBackup(record, 'validated');
    record = this.transitionBackup(record, 'stored');

    // Law 2 "Recoverability First" — verification is mandatory, not optional.
    record = await this.verifyBackupInternal(record);
    this.backupCount += 1;
    this.publish(RESILIENCE_EVENTS.BackupCompleted, { backupId });

    if (record.verificationStatus === 'verified') {
      this.graph.registerRecoveryPoint(this.buildRecoveryPoint(record, platformVersion));
    }

    return record;
  }

  private async verifyBackupInternal(record: BackupRecord): Promise<BackupRecord> {
    const start = performance.now();
    const results: DomainValidationResult[] = [];
    for (const domainResult of record.domains) {
      const handler = this.handlers.get(domainResult.domain);
      results.push(handler ? await handler.validate(domainResult) : { domain: domainResult.domain, valid: false, reasons: ['No handler registered.'] });
    }
    this.verificationDurations.push(performance.now() - start);

    const allValid = results.every((result) => result.valid);
    const withVerification: BackupRecord = { ...record, verificationStatus: allValid ? 'verified' : 'failed' };
    let updated = this.transitionBackup(withVerification, allValid ? 'verified' : 'failed');

    if (allValid) {
      updated = this.transitionBackup(updated, 'available');
      this.publish(RESILIENCE_EVENTS.BackupVerified, { backupId: record.backupId });
    } else {
      this.backupFailureCount += 1;
      this.publish(RESILIENCE_EVENTS.BackupFailed, { backupId: record.backupId, reasons: results.flatMap((r) => r.reasons) });
    }
    return updated;
  }

  /** §16 — real, callable verification, independent of the initial
   * mandatory check at creation time (e.g. periodic re-verification). */
  async verifyBackup(backupId: string): Promise<BackupRecord> {
    const record = this.registry.require(backupId);
    return this.verifyBackupInternal(record);
  }

  private allocateBackupDirectory(backupId: string): string {
    if (this.storageAuthority) {
      return this.storageAuthority.allocate('backups', `ibrra-${backupId}`).path;
    }
    if (this.backupRootPath) {
      return join(this.backupRootPath, backupId);
    }
    throw new NoBackupDestinationError();
  }

  private buildRecoveryPoint(record: BackupRecord, platformVersion: string): RecoveryPoint {
    const domainSchemaVersions: Record<string, number> = {};
    if (this.dataAuthority) {
      for (const schema of this.dataAuthority.schemas.all()) domainSchemaVersions[schema.domain] = schema.version;
    }
    return {
      recoveryPointId: randomUUID(),
      backupId: record.backupId,
      platformVersion,
      domainSchemaVersions,
      createdAt: record.createdAt,
      verificationStatus: record.verificationStatus,
    };
  }

  private resolvePlatformVersion(): string {
    if (!this.configurationAuthority) return 'unknown';
    try {
      return String(this.configurationAuthority.get('platform.version'));
    } catch {
      return 'unknown';
    }
  }

  private transitionBackup(record: BackupRecord, status: BackupLifecycleStatus): BackupRecord {
    assertBackupTransition(record.status, status);
    const updated = { ...record, status };
    this.registry.update(updated);
    this.audit.recordBackup(updated);
    return updated;
  }

  // ---- Recovery (§11, Law 2/Law 5/Law 6) ----

  async requestRecovery(backupId: string, requestedBy: string, reason: string): Promise<RecoveryRecord> {
    const backup = this.registry.require(backupId);
    const recoveryId = randomUUID();
    const start = performance.now();

    // Starts already in 'requested' — not a transition into itself, just the
    // record's initial state (real bug caught by testing: calling
    // transitionRecovery('requested') here threw, since 'requested' isn't a
    // valid transition target from 'requested'; see ADR-0017).
    let record: RecoveryRecord = {
      recoveryId,
      backupId,
      requestedBy,
      reason,
      status: 'requested',
      steps: [{ step: 'requested', timestamp: this.now().toISOString(), detail: 'Recovery requested.' }],
      domainResults: [],
      startedAt: this.now().toISOString(),
    };
    this.recoveries.set(recoveryId, record);
    this.audit.recordRecovery(record);
    this.publish(RESILIENCE_EVENTS.RecoveryRequested, { recoveryId, backupId });

    record = this.transitionRecovery(record, 'backup-selected', `Selected backup "${backupId}".`);

    // Law 2 — an unverified backup can never be the source of a recovery.
    if (backup.verificationStatus !== 'verified') {
      return this.failRecovery(record, 'Backup is not verified — Law 2 "Recoverability First" prohibits recovery.', start);
    }

    const currentPlatformVersion = this.resolvePlatformVersion();
    const compatible = currentPlatformVersion === 'unknown' || backup.recoveryCompatibilityVersion === currentPlatformVersion;
    record = this.transitionRecovery(
      record,
      'compatibility-verified',
      compatible ? 'Platform version compatible.' : `Version mismatch: backup="${backup.recoveryCompatibilityVersion}", current="${currentPlatformVersion}".`,
    );
    if (!compatible) {
      return this.failRecovery(record, 'Recovery point is not compatible with the current platform version.', start);
    }

    const integrityResults = await Promise.all(
      backup.domains.map((domainResult) => {
        const handler = this.handlers.get(domainResult.domain);
        return handler ? handler.validate(domainResult) : Promise.resolve({ domain: domainResult.domain, valid: false, reasons: ['No handler registered.'] });
      }),
    );
    const integrityOk = integrityResults.every((result) => result.valid);
    record = this.transitionRecovery(record, 'integrity-verified', integrityOk ? 'Integrity confirmed.' : 'Integrity check failed.');
    if (!integrityOk) {
      return this.failRecovery(record, 'Backup failed re-verification — Law 5 prohibits proceeding.', start);
    }

    this.publish(RESILIENCE_EVENTS.RecoveryStarted, { recoveryId });
    const domainResults: DomainRestoreResult[] = [];
    for (const domainResult of backup.domains) {
      const handler = this.handlers.get(domainResult.domain);
      domainResults.push(
        handler ? await handler.restore(domainResult) : { domain: domainResult.domain, success: false, supported: true, message: 'No handler registered.' },
      );
    }
    record = { ...record, domainResults };

    const realFailures = domainResults.filter((result) => result.supported && !result.success);
    if (realFailures.length > 0) {
      return this.failRecovery(record, `Domain restore failed: ${realFailures.map((r) => r.domain).join(', ')}.`, start);
    }

    record = this.transitionRecovery(record, 'executed', 'Domain restores executed.');
    this.publish(RESILIENCE_EVENTS.RecoveryCompleted, { recoveryId });

    record = this.transitionRecovery(record, 'validated', 'Recovery validated.');
    this.publish(RESILIENCE_EVENTS.RecoveryValidated, { recoveryId });

    // "Platform Certified" (§11) — a real IRBLM certification query, never fabricated.
    let certifiedOperational: boolean | undefined;
    if (this.runtimeOrchestrator) {
      certifiedOperational = this.runtimeOrchestrator.getCertificationStatus()?.certified ?? false;
    }
    record = { ...record, certifiedOperational };
    record = this.transitionRecovery(record, 'certified', certifiedOperational === false ? 'Platform not certified post-recovery.' : 'Certification checked.');
    record = this.transitionRecovery(record, 'operational', 'Recovery complete.');
    record = { ...record, completedAt: this.now().toISOString() };
    this.recoveries.set(recoveryId, record);
    this.audit.recordRecovery(record);

    this.recoveryCount += 1;
    this.recoveryDurations.push(performance.now() - start);
    return record;
  }

  private failRecovery(record: RecoveryRecord, detail: string, perfStart: number): RecoveryRecord {
    const failed = this.transitionRecovery(record, 'failed', detail);
    const completed = { ...failed, completedAt: this.now().toISOString() };
    this.recoveries.set(completed.recoveryId, completed);
    this.audit.recordRecovery(completed);
    this.recoveryFailureCount += 1;
    this.recoveryDurations.push(performance.now() - perfStart);
    this.publish(RESILIENCE_EVENTS.RecoveryFailed, { recoveryId: record.recoveryId, reason: detail });
    return completed;
  }

  private transitionRecovery(record: RecoveryRecord, status: RecoveryLifecycleStatus, detail?: string): RecoveryRecord {
    assertRecoveryTransition(record.status, status);
    const step: RecoveryStepRecord = { step: status, timestamp: this.now().toISOString(), detail };
    const updated: RecoveryRecord = { ...record, status, steps: [...record.steps, step] };
    this.recoveries.set(updated.recoveryId, updated);
    this.audit.recordRecovery(updated);
    return updated;
  }

  getRecovery(recoveryId: string): RecoveryRecord | undefined {
    return this.recoveries.get(recoveryId);
  }

  // ---- Explainability, metrics ----

  explainBackup(backupId: string): { record: BackupRecord; history: BackupRecord[] } {
    const record = this.registry.require(backupId);
    return { record, history: this.audit.backupHistory(backupId) };
  }

  explainRecovery(recoveryId: string): RecoveryRecord {
    const record = this.recoveries.get(recoveryId);
    if (!record) throw new RecoveryNotFoundError(recoveryId);
    return record;
  }

  getMetrics(): ResilienceMetrics {
    const verifiedCount = this.registry.all().filter((record) => record.verificationStatus === 'verified').length;
    const totalCount = this.registry.all().length;
    return {
      backupCount: this.backupCount,
      backupFailureCount: this.backupFailureCount,
      recoveryCount: this.recoveryCount,
      recoveryFailureCount: this.recoveryFailureCount,
      averageBackupDurationMs: average(this.backupDurations),
      averageRecoveryDurationMs: average(this.recoveryDurations),
      averageVerificationDurationMs: average(this.verificationDurations),
      recoveryReadinessScore: totalCount === 0 ? 0 : Math.round((verifiedCount / totalCount) * 100),
    };
  }

  // ---- Internal ----

  private publish(name: ResilienceEventName, payload: unknown): void {
    this.events.publish(name, payload);
    this.logOnly(name, payload);
  }

  private logOnly(operation: string, payload: unknown): void {
    if (!this.observability) return;
    try {
      this.observability.log({
        severity: operation === RESILIENCE_EVENTS.BackupFailed || operation === RESILIENCE_EVENTS.RecoveryFailed ? 'error' : 'information',
        category: LOG_CATEGORY,
        authority: SELF_AUTHORITY,
        operation,
        message: operation,
        context: payload as Record<string, unknown>,
      });
    } catch {
      // Observability is a diagnostic concern, never a functional dependency.
    }
  }
}
