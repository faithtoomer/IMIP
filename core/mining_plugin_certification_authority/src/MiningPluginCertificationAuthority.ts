import { PluginCertificationEvidenceLedger } from './evidence.js';
import { MiningPluginCertificationEventBus, MINING_PLUGIN_CERTIFICATION_EVENTS } from './events.js';
import { explainPluginCertification } from './explainability.js';
import { assignCertificationLevel } from './levelAssignment.js';
import { assertPluginCertificationLifecycleTransition } from './lifecycle.js';
import { PluginCertificationPipeline } from './pipeline.js';
import type { MiningPluginCertificationAuthorityDependencies } from './providers.js';
import { PluginCertificationRegistry } from './registry.js';
import { decidePluginTrust, assertNoPluginSelfCertification } from './trust.js';
import { InstitutionalPluginTrustGraph } from './trustGraph.js';
import { CertificationLifecycleStage, type EvidenceRecord, type PluginCertificationRecord, type PluginCertificationStatusOutput, type PluginCertificationSubmission } from './types.js';

export class MiningPluginCertificationAuthority {
  readonly registry = new PluginCertificationRegistry();
  readonly evidence = new PluginCertificationEvidenceLedger();
  readonly events: MiningPluginCertificationEventBus;
  readonly trustGraph = new InstitutionalPluginTrustGraph();
  private readonly pipeline: PluginCertificationPipeline;
  private counter = 0;

  constructor(private readonly dependencies: MiningPluginCertificationAuthorityDependencies) {
    this.events = new MiningPluginCertificationEventBus(dependencies.eventBus);
    this.pipeline = new PluginCertificationPipeline(dependencies.providers, () => this.uuid('evidence'));
  }

  submit(input: PluginCertificationSubmission): Readonly<PluginCertificationRecord> {
    assertNoPluginSelfCertification(input.manifest);
    if (!input.pluginUuid || !input.version) throw new Error('Plugin UUID and version are required for certification.');
    const at = this.dependencies.clock.now();
    const record: PluginCertificationRecord = { certificationId: this.uuid('plugin-certification'), pluginUuid: input.pluginUuid, version: input.version, lifecycleStage: CertificationLifecycleStage.Submitted, evidenceReferences: [], pipelineResults: [], lifecycle: [{ from: undefined, to: CertificationLifecycleStage.Submitted, at, reason: 'Plugin certification was requested.' }], submittedAt: at, updatedAt: at, recertificationAttempts: 0 };
    const stored=this.registry.upsert(record); this.events.publish(MINING_PLUGIN_CERTIFICATION_EVENTS.PluginCertificationRequested, this.payload(stored)); return stored;
  }

  async runPipeline(certificationId: string, manifest?: PluginCertificationSubmission['manifest']): Promise<Readonly<PluginCertificationRecord>> {
    let record=this.copy(this.registry.require(certificationId));
    if (record.lifecycleStage === CertificationLifecycleStage.Revoked) throw new Error('Revoked certification must use recertify(), which re-runs the full pipeline.');
    if (record.lifecycleStage !== CertificationLifecycleStage.Submitted) throw new Error(`Pipeline can begin only from Submitted, not ${record.lifecycleStage}.`);
    assertNoPluginSelfCertification(manifest);
    this.transition(record, CertificationLifecycleStage.Validated, 'Submission identity and absence of self-certification claims were validated.');
    this.save(record); this.events.publish(MINING_PLUGIN_CERTIFICATION_EVENTS.PluginCertificationStarted, this.payload(record));
    const execution=await this.pipeline.run(
      { pluginUuid:record.pluginUuid, version:record.version, manifest, certificationId:record.certificationId },
      (result) => {
        if (result.stage === 'StaticValidation' && result.passed) this.transition(record, CertificationLifecycleStage.Testing, 'Static validation passed; sequential provider-backed testing began.');
      },
    );
    const evidence: EvidenceRecord[] = execution.results.map((result, index) => ({ evidenceId:result.evidenceReference, pluginUuid:record.pluginUuid, version:record.version, certificationId:record.certificationId, stage:result.stage, type:execution.providerResults[index]!.evidenceType, payload:execution.providerResults[index]!.payload, observedAt:this.dependencies.clock.now(), providerRationale:result.rationale, passed:result.passed, degraded:result.degraded }));
    evidence.forEach((entry) => this.evidence.append(entry));
    record.evidenceReferences=evidence.map((entry) => entry.evidenceId); record.pipelineResults=execution.results;
    this.trustGraph.record(record.certificationId, record.pluginUuid, record.version, this.recordEvidence(record));
    if (execution.failedStage) {
      const failureStage = execution.failedStage === 'StaticValidation' ? CertificationLifecycleStage.Rejected : CertificationLifecycleStage.Failed;
      this.transition(record, failureStage, `${execution.failedStage} failed: ${execution.results.at(-1)!.rationale}`);
      record.decisionReason=`${execution.failedStage} failed: ${execution.results.at(-1)!.rationale}`;
      const stored=this.save(record); this.events.publish(MINING_PLUGIN_CERTIFICATION_EVENTS.PluginCertificationFailed, this.payload(stored, record.decisionReason)); return stored;
    }
    this.transition(record, CertificationLifecycleStage.EvidenceCollected, 'All seven IMPCA pipeline stages passed and immutable evidence was recorded.');
    const stored=this.save(record); this.events.publish(MINING_PLUGIN_CERTIFICATION_EVENTS.PluginCertificationPassed, this.payload(stored)); return stored;
  }

  async certify(certificationId: string): Promise<Readonly<PluginCertificationRecord>> {
    const record=this.copy(this.registry.require(certificationId));
    if (record.lifecycleStage !== CertificationLifecycleStage.EvidenceCollected) throw new Error(`Certification review requires EvidenceCollected, not ${record.lifecycleStage}.`);
    this.transition(record, CertificationLifecycleStage.Reviewed, 'Evidence trail entered IMPCA review.');
    const evidence=this.recordEvidence(record);
    const level=assignCertificationLevel(record.pipelineResults, evidence);
    if (!level || evidence.length === 0) { this.transition(record, CertificationLifecycleStage.Failed, 'Evidence did not satisfy deterministic certification rules.'); record.decisionReason='Certification denied because the IMPCA evidence trail was incomplete or insufficient.'; const stored=this.save(record); this.events.publish(MINING_PLUGIN_CERTIFICATION_EVENTS.PluginCertificationFailed, this.payload(stored, record.decisionReason)); return stored; }
    record.certificationLevel=level; record.decisionReason=`Evidence-backed certification granted at ${level}.`;
    this.transition(record, CertificationLifecycleStage.Certified, record.decisionReason);
    this.events.publish(MINING_PLUGIN_CERTIFICATION_EVENTS.PluginCertified, this.payload(record));
    this.transition(record, CertificationLifecycleStage.Active, 'Evidence-backed certification is active.');
    const stored=this.save(record);
    await this.dependencies.capabilityRegistrationNotifier?.notifyCertification({ pluginUuid:stored.pluginUuid, version:stored.version, certificationId:stored.certificationId, status:this.statusFor(stored) });
    return stored;
  }

  suspend(certificationId: string, reason: string): Readonly<PluginCertificationRecord> { const record=this.copy(this.registry.require(certificationId)); this.transition(record, CertificationLifecycleStage.Suspended, reason); record.decisionReason=reason; const stored=this.save(record); this.events.publish(MINING_PLUGIN_CERTIFICATION_EVENTS.PluginCertificationSuspended, this.payload(stored, reason)); return stored; }
  revoke(certificationId: string, reason: string): Readonly<PluginCertificationRecord> { const record=this.copy(this.registry.require(certificationId)); this.transition(record, CertificationLifecycleStage.Revoked, reason); record.decisionReason=reason; const stored=this.save(record); this.events.publish(MINING_PLUGIN_CERTIFICATION_EVENTS.PluginCertificationRevoked, this.payload(stored, reason)); return stored; }

  async recertify(certificationId: string, manifest?: PluginCertificationSubmission['manifest']): Promise<Readonly<PluginCertificationRecord>> {
    let record=this.copy(this.registry.require(certificationId));
    if (record.lifecycleStage !== CertificationLifecycleStage.Revoked && record.lifecycleStage !== CertificationLifecycleStage.Suspended) throw new Error('Only a revoked or suspended certification may enter the full recertification pipeline.');
    assertNoPluginSelfCertification(manifest);
    this.events.publish(MINING_PLUGIN_CERTIFICATION_EVENTS.PluginRecertificationRequired, this.payload(record, 'Revocation requires a full pipeline re-run.'));
    this.transition(record, CertificationLifecycleStage.Recertified, 'Full recertification pipeline was requested after revocation.');
    // A new immutable certification run preserves revoked history while allowing no direct un-revoke path.
    this.transition(record, CertificationLifecycleStage.Submitted, 'Fresh full pipeline run started for recertification.');
    record.evidenceReferences=[]; record.pipelineResults=[]; record.recertificationAttempts += 1;
    this.save(record);
    const run=await this.runPipeline(certificationId, manifest);
    if (run.lifecycleStage !== CertificationLifecycleStage.EvidenceCollected) return run;
    const certified=await this.certify(certificationId);
    if (certified.lifecycleStage === CertificationLifecycleStage.Active) this.events.publish(MINING_PLUGIN_CERTIFICATION_EVENTS.PluginRecertified, this.payload(certified));
    return certified;
  }

  getCertificationStatus(input: { pluginUuid: string; version: string; manifest?: PluginCertificationSubmission['manifest'] }): PluginCertificationStatusOutput {
    try { assertNoPluginSelfCertification(input.manifest); } catch (error) { return { certified:false, level:'None', reason:error instanceof Error ? error.message : String(error) }; }
    const record=this.registry.latest(input.pluginUuid, input.version);
    if (!record) return { certified:false, level:'None', reason:'No IMPCA certification record exists for this plugin version.' };
    try { return this.statusFor(record); } catch (error) { return { certified:false, level:record.certificationLevel ?? 'None', reason:error instanceof Error ? error.message : String(error) }; }
  }
  explain(certificationId: string) { const record=this.registry.require(certificationId); return explainPluginCertification(record, this.recordEvidence(record)); }

  private statusFor(record: Readonly<PluginCertificationRecord>): PluginCertificationStatusOutput { return decidePluginTrust(record, this.recordEvidence(record)); }
  private transition(record: PluginCertificationRecord, to: CertificationLifecycleStage, reason: string): void { const from=record.lifecycleStage; assertPluginCertificationLifecycleTransition(from, to); const at=this.dependencies.clock.now(); record.lifecycleStage=to; record.lifecycle=[...record.lifecycle, {from,to,at,reason}]; record.updatedAt=at; }
  private save(record: PluginCertificationRecord): Readonly<PluginCertificationRecord> { return this.registry.upsert(record); }
  private uuid(prefix: string): string { return this.dependencies.createUuid?.() ?? `${prefix}-${++this.counter}`; }
  private payload(record: Readonly<PluginCertificationRecord>, reason?: string) { return { certificationId:record.certificationId, pluginUuid:record.pluginUuid, version:record.version, stage:record.lifecycleStage, reason }; }
  private copy(record: Readonly<PluginCertificationRecord>): PluginCertificationRecord { return JSON.parse(JSON.stringify(record)) as PluginCertificationRecord; }
  private recordEvidence(record: Readonly<PluginCertificationRecord>): EvidenceRecord[] {
    const allowed = new Set(record.evidenceReferences);
    return (this.evidence.evidenceFor(record.certificationId) as EvidenceRecord[]).filter((entry) => allowed.has(entry.evidenceId));
  }
}
