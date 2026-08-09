import { PluginCertificationEvidenceError, PluginSelfCertificationError } from './errors.js';
import { CertificationLifecycleStage, type EvidenceRecord, type PluginCertificationManifest, type PluginCertificationRecord, type PluginCertificationStatusOutput } from './types.js';

const SELF_DECLARATION_FIELDS = ['selfDeclaredCertificationLevel', 'certificationLevel', 'certified', 'selfCertified'];

/** Refuses assertions of trust made by the subject plugin itself. */
export function assertNoPluginSelfCertification(manifest: PluginCertificationManifest | undefined): void {
  if (manifest && SELF_DECLARATION_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(manifest, field))) throw new PluginSelfCertificationError();
}

/** No status can become certified without a complete evidence-backed pipeline decision. */
export function decidePluginTrust(record: PluginCertificationRecord, evidence: readonly EvidenceRecord[]): PluginCertificationStatusOutput {
  if (record.lifecycleStage === CertificationLifecycleStage.Revoked) return { certified: false, level: record.certificationLevel ?? 'None', reason: 'Certification is revoked; full recertification is required before production use.' };
  const certifiable = record.lifecycleStage === CertificationLifecycleStage.Certified || record.lifecycleStage === CertificationLifecycleStage.Active || record.lifecycleStage === CertificationLifecycleStage.Recertified;
  if (!certifiable) return { certified: false, level: record.certificationLevel ?? 'None', reason: record.decisionReason ?? `Certification is currently ${record.lifecycleStage}.` };
  if (evidence.length === 0 || record.evidenceReferences.length === 0 || !record.certificationLevel) throw new PluginCertificationEvidenceError();
  return { certified: true, level: record.certificationLevel, reason: record.decisionReason ?? 'Evidence-backed IMPCA certification is active.' };
}
