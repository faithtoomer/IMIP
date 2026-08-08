import { randomUUID } from 'node:crypto';
import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import type { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import { ArtifactTypeRegistry } from './artifactTypeRegistry.js';
import { VersionRegistry } from './versionRegistry.js';
import { ArtifactCompatibilityRegistry } from './artifactCompatibilityRegistry.js';
import { MigrationRegistry } from './migrationRegistry.js';
import { InstitutionalEvolutionGraph } from './evolutionGraph.js';
import { VersionAuditTrail } from './auditTrail.js';
import { VersionEventBus } from './events.js';
import { assertMigrationTransition, assertVersionTransition } from './lifecycle.js';
import { NoMigrationExecutorError, UnregisteredArtifactTypeError } from './errors.js';
import { VERSION_EVENTS } from './types.js';
import type {
  ArtifactVersionSource,
  DeprecationInfo,
  MigrationExecutor,
  MigrationPlan,
  MigrationRecord,
  MigrationRequest,
  MigrationStatus,
  VersionGovernanceMetrics,
  VersionRecord,
  VersionStatus,
} from './types.js';

export interface VersionGovernanceAuthorityOptions {
  eventBus?: InstitutionalEventBus;
  observabilityAuthority?: ObservabilityAuthority;
  versionSources?: ArtifactVersionSource[];
  migrationExecutors?: MigrationExecutor[];
  now?: () => Date;
}

const LOG_CATEGORY = 'version-governance';
const SELF_AUTHORITY = 'Version Governance & Migration Authority';

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * IVGMA — the Institutional Version Governance & Migration Authority
 * (PHASE-15), Program II's final phase. The sole authority for version
 * governance, compatibility management, and migration orchestration.
 * IVGMA never reimplements the migration/rollback mechanics it governs —
 * every migration executor wraps ICMS's/IDA's own real, existing
 * mechanisms (Law 1, applied reflexively to IVGMA's own design, the same
 * discipline established for IBRRA in ADR-0017). See ADR-0018.
 */
export class VersionGovernanceAuthority {
  readonly artifactTypes = new ArtifactTypeRegistry();
  readonly versions = new VersionRegistry();
  readonly compatibility = new ArtifactCompatibilityRegistry();
  readonly migrations = new MigrationRegistry();
  readonly graph: InstitutionalEvolutionGraph;
  readonly audit = new VersionAuditTrail();
  readonly events: VersionEventBus;

  private readonly versionSources = new Map<string, ArtifactVersionSource>();
  private readonly migrationExecutors = new Map<string, MigrationExecutor>();
  private readonly observability?: ObservabilityAuthority;
  private readonly now: () => Date;

  private migrationCount = 0;
  private migrationFailureCount = 0;
  private rollbackCount = 0;
  private rollbackFailureCount = 0;
  private readonly migrationDurations: number[] = [];
  private readonly verificationDurations: number[] = [];
  private readonly rollbackDurations: number[] = [];

  constructor(options: VersionGovernanceAuthorityOptions = {}) {
    this.observability = options.observabilityAuthority;
    this.now = options.now ?? (() => new Date());
    this.events = new VersionEventBus(options.eventBus);
    this.graph = new InstitutionalEvolutionGraph(
      () => this.versions.all(),
      () => this.migrations.all(),
      () => this.compatibility.all(),
    );

    for (const source of options.versionSources ?? []) this.registerVersionSource(source);
    for (const executor of options.migrationExecutors ?? []) this.registerMigrationExecutor(executor);

    if (this.observability) {
      if (!this.observability.categories.has(LOG_CATEGORY)) this.observability.registerCategory(LOG_CATEGORY);
      for (const name of Object.values(VERSION_EVENTS)) {
        if (!this.observability.schemas.get(LOG_CATEGORY, name)) {
          this.observability.registerSchema({ category: LOG_CATEGORY, operation: name, description: `IVGMA event: ${name}` });
        }
      }
    }
  }

  registerVersionSource(source: ArtifactVersionSource): void {
    this.artifactTypes.register(source.artifactType);
    this.versionSources.set(source.artifactType, source);
  }

  registerMigrationExecutor(executor: MigrationExecutor): void {
    this.artifactTypes.register(executor.artifactType);
    this.migrationExecutors.set(executor.artifactType, executor);
  }

  // ---- Version Registry (§6, §9) ----

  registerVersion(input: {
    artifactType: string;
    artifactName: string;
    semanticVersion: string;
    ownerAuthority: string;
    releaseDate?: string;
    compatibilityVersion?: string;
    migrationVersion?: string;
  }): VersionRecord {
    if (!this.artifactTypes.has(input.artifactType)) throw new UnregisteredArtifactTypeError(input.artifactType);

    const record: VersionRecord = {
      versionId: randomUUID(),
      artifactType: input.artifactType,
      artifactName: input.artifactName,
      semanticVersion: input.semanticVersion,
      releaseDate: input.releaseDate,
      compatibilityVersion: input.compatibilityVersion,
      migrationVersion: input.migrationVersion,
      status: 'created',
      ownerAuthority: input.ownerAuthority,
      certificationStatus: 'uncertified',
      createdAt: this.now().toISOString(),
    };
    this.versions.register(record);
    this.audit.recordVersion(record);

    const registered = this.transitionVersion(record, 'registered');
    this.publish(VERSION_EVENTS.VersionRegistered, { versionId: record.versionId, artifactType: record.artifactType, semanticVersion: record.semanticVersion });
    return registered;
  }

  /** Pulls the current, real version data from every registered
   * `ArtifactVersionSource` and registers anything not already cataloged —
   * the real way new versions of already-versioned artifacts (ICMS's
   * schema version, IDA's domain schema versions, IEB's event versions)
   * enter the Version Registry. */
  syncVersions(ownerAuthority = SELF_AUTHORITY): VersionRecord[] {
    const registered: VersionRecord[] = [];
    for (const source of this.versionSources.values()) {
      for (const snapshot of source.currentVersions()) {
        const existing = this.versions.find(snapshot.artifactType, snapshot.artifactName, snapshot.semanticVersion);
        if (existing) continue;
        registered.push(
          this.registerVersion({
            artifactType: snapshot.artifactType,
            artifactName: snapshot.artifactName,
            semanticVersion: snapshot.semanticVersion,
            compatibilityVersion: snapshot.compatibilityVersion,
            migrationVersion: snapshot.migrationVersion,
            ownerAuthority,
          }),
        );
      }
    }
    return registered;
  }

  certifyVersion(versionId: string, certified: boolean): VersionRecord {
    const record = this.versions.require(versionId);
    const updated: VersionRecord = { ...record, certificationStatus: certified ? 'certified' : 'rejected' };
    return this.transitionVersion(updated, certified ? 'certified' : 'rejected');
  }

  releaseVersion(versionId: string): VersionRecord {
    const record = this.versions.require(versionId);
    const released = this.transitionVersion(record, 'released');
    this.publish(VERSION_EVENTS.VersionReleased, { versionId, semanticVersion: record.semanticVersion });
    return released;
  }

  markSupported(versionId: string): VersionRecord {
    const record = this.versions.require(versionId);
    return this.transitionVersion(record, 'supported');
  }

  deprecateVersion(versionId: string, info: Omit<DeprecationInfo, 'deprecatedAt'>): VersionRecord {
    const record = this.versions.require(versionId);
    const withDeprecation: VersionRecord = { ...record, deprecation: { ...info, deprecatedAt: this.now().toISOString() } };
    const deprecated = this.transitionVersion(withDeprecation, 'deprecated');
    this.publish(VERSION_EVENTS.VersionDeprecated, { versionId, semanticVersion: record.semanticVersion });
    return deprecated;
  }

  retireVersion(versionId: string): VersionRecord {
    const record = this.versions.require(versionId);
    return this.transitionVersion(record, 'retired');
  }

  private transitionVersion(record: VersionRecord, status: VersionStatus): VersionRecord {
    assertVersionTransition(record.status, status);
    const updated = { ...record, status };
    this.versions.update(updated);
    this.audit.recordVersion(updated);
    return updated;
  }

  // ---- Compatibility (§7, Law 3) ----

  recordCompatibility(fromArtifactType: string, fromVersion: string, toArtifactType: string, toVersion: string, compatible: boolean, reason?: string) {
    const relationship = this.compatibility.record(fromArtifactType, fromVersion, toArtifactType, toVersion, compatible, reason);
    this.publish(VERSION_EVENTS.CompatibilityVerified, { fromArtifactType, fromVersion, toArtifactType, toVersion, compatible });
    return relationship;
  }

  // ---- Migration (§8, §10, §11, Law 3/Law 4) ----

  planMigration(request: MigrationRequest, requestedBy: string): MigrationRecord {
    if (!this.artifactTypes.has(request.artifactType)) throw new UnregisteredArtifactTypeError(request.artifactType);

    const migrationId = randomUUID();
    const record: MigrationRecord = {
      migrationId,
      ...request,
      status: 'planned',
      steps: [{ step: 'planned', timestamp: this.now().toISOString() }],
      requestedBy,
      startedAt: this.now().toISOString(),
    };
    this.migrations.register(record);
    this.audit.recordMigration(record);
    this.publish(VERSION_EVENTS.MigrationPlanned, { migrationId, artifactType: request.artifactType, sourceVersion: request.sourceVersion, targetVersion: request.targetVersion });
    return record;
  }

  async executeMigration(migrationId: string): Promise<MigrationRecord> {
    let record = this.migrations.require(migrationId);
    const start = performance.now();
    const executor = this.migrationExecutors.get(record.artifactType);
    if (!executor) throw new NoMigrationExecutorError(record.artifactType);

    record = this.transitionMigration(record, 'validated', 'Migration plan validated.');

    // Law 3 "Compatibility Before Migration" — fail-closed: no recorded,
    // verified-compatible relationship means compatibility is not
    // considered verified, not silently assumed safe.
    const relationship = this.compatibility.check(record.artifactType, record.sourceVersion, record.artifactType, record.targetVersion);
    const compatible = relationship?.compatible ?? false;
    this.publish(VERSION_EVENTS.CompatibilityVerified, { migrationId, compatible });
    if (!compatible) {
      return this.rollbackMigration(
        this.transitionMigration(record, 'rollback', 'No verified-compatible relationship recorded — Law 3 prohibits proceeding.'),
        executor,
        start,
      );
    }
    record = this.transitionMigration(record, 'compatibility-verified', 'Compatibility verified.');

    this.publish(VERSION_EVENTS.MigrationStarted, { migrationId });
    const executionResult = await executor.execute(record);
    if (!executionResult.success) {
      return this.rollbackMigration(this.transitionMigration(record, 'rollback', executionResult.message ?? 'Execution failed.'), executor, start);
    }
    record = this.transitionMigration(record, 'executed', 'Migration executed.');

    const verificationStart = performance.now();
    const verificationResult = await executor.verify(record);
    this.verificationDurations.push(performance.now() - verificationStart);
    if (!verificationResult.valid) {
      return this.rollbackMigration(
        this.transitionMigration(record, 'rollback', verificationResult.reasons.join('; ') || 'Verification failed.'),
        executor,
        start,
      );
    }
    record = this.transitionMigration(record, 'verified', 'Migration verified.');

    record = this.transitionMigration(record, 'certified', 'Migration certified.');
    this.migrationCount += 1;
    this.migrationDurations.push(performance.now() - start);
    this.publish(VERSION_EVENTS.MigrationCompleted, { migrationId });
    return record;
  }

  private async rollbackMigration(record: MigrationRecord, executor: MigrationExecutor, perfStart: number): Promise<MigrationRecord> {
    const rollbackStart = performance.now();
    this.publish(VERSION_EVENTS.RollbackStarted, { migrationId: record.migrationId });

    const rollbackResult = await executor.rollback(record);
    this.rollbackDurations.push(performance.now() - rollbackStart);

    let updated: MigrationRecord;
    if (rollbackResult.success) {
      updated = this.transitionMigration(record, 'rolled-back', 'Rollback completed.');
      this.rollbackCount += 1;
      this.publish(VERSION_EVENTS.RollbackCompleted, { migrationId: record.migrationId });
    } else {
      updated = this.transitionMigration(record, 'failed', rollbackResult.message ?? 'Rollback failed.');
      this.rollbackFailureCount += 1;
    }

    this.migrationFailureCount += 1;
    this.migrationDurations.push(performance.now() - perfStart);
    this.publish(VERSION_EVENTS.MigrationFailed, { migrationId: record.migrationId, reason: updated.steps.at(-1)?.detail });
    return updated;
  }

  /** Convenience: plan then execute in one call — the natural single entry
   * point for "migrate this artifact from X to Y," while `planMigration()`/
   * `executeMigration()` remain available separately (§17 names "Migration
   * planning" and "Migration execution request" as distinct interfaces). */
  async requestMigration(request: MigrationRequest, requestedBy: string): Promise<MigrationRecord> {
    const plan = this.planMigration(request, requestedBy);
    return this.executeMigration(plan.migrationId);
  }

  private transitionMigration(record: MigrationRecord, status: MigrationStatus, detail?: string): MigrationRecord {
    assertMigrationTransition(record.status, status);
    const step = { step: status, timestamp: this.now().toISOString(), detail };
    const updated: MigrationRecord = {
      ...record,
      status,
      steps: [...record.steps, step],
      completedAt: status === 'certified' || status === 'rolled-back' || status === 'failed' ? this.now().toISOString() : record.completedAt,
    };
    this.migrations.update(updated);
    this.audit.recordMigration(updated);
    return updated;
  }

  // ---- Explainability, metrics ----

  explainVersion(versionId: string): { record: VersionRecord; history: VersionRecord[] } {
    const record = this.versions.require(versionId);
    return { record, history: this.audit.versionHistory(versionId) };
  }

  explainMigration(migrationId: string): MigrationRecord {
    return this.migrations.require(migrationId);
  }

  getMetrics(): VersionGovernanceMetrics {
    return {
      migrationCount: this.migrationCount,
      migrationFailureCount: this.migrationFailureCount,
      rollbackCount: this.rollbackCount,
      rollbackFailureCount: this.rollbackFailureCount,
      averageMigrationDurationMs: average(this.migrationDurations),
      averageVerificationDurationMs: average(this.verificationDurations),
      averageRollbackDurationMs: average(this.rollbackDurations),
      activeSupportedVersionCount: this.versions.supported().length,
      deprecatedArtifactCount: this.versions.deprecated().length,
    };
  }

  // ---- Internal ----

  private publish(name: (typeof VERSION_EVENTS)[keyof typeof VERSION_EVENTS], payload: unknown): void {
    this.events.publish(name, payload);
    this.logOnly(name, payload);
  }

  private logOnly(operation: string, payload: unknown): void {
    if (!this.observability) return;
    try {
      this.observability.log({
        severity: operation === VERSION_EVENTS.MigrationFailed ? 'error' : 'information',
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
