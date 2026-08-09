import { CertificationLevel, type EvidenceRecord, type PipelineStageResult } from './types.js';
import { PLUGIN_CERTIFICATION_LEVEL_POLICIES } from './policies.js';

function score(record: EvidenceRecord): number { const candidate = record.payload.qualityScore; return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0; }
function stage(records: readonly EvidenceRecord[], name: string): EvidenceRecord | undefined { return records.find((record) => record.stage === name); }

/**
 * Deterministic rule set: all seven stages must pass for Experimental; all records
 * scoring >=60 yield Development; >=75 yields Qualified; production additionally
 * requires Performance and Runtime >=85 with no degradation; InstitutionalCritical
 * additionally requires every score >=95 and explicit provider-produced critical evidence.
 */
export function assignCertificationLevel(results: readonly PipelineStageResult[], evidence: readonly EvidenceRecord[]): CertificationLevel | undefined {
  if (results.length !== 7 || evidence.length !== 7 || results.some((result) => !result.passed) || evidence.some((record) => !record.passed)) return undefined;
  if (evidence.some((record) => record.payload.certificationBlocked === true)) return undefined;
  const critical = PLUGIN_CERTIFICATION_LEVEL_POLICIES[CertificationLevel.InstitutionalCritical];
  if (evidence.every((record) => score(record) >= critical.minimumQualityScore) && evidence.every((record) => !record.degraded) && evidence.some((record) => record.payload.institutionalCritical === true)) return CertificationLevel.InstitutionalCritical;
  const performance = stage(evidence, 'PerformanceTesting');
  const runtime = stage(evidence, 'RuntimeTesting');
  const production = PLUGIN_CERTIFICATION_LEVEL_POLICIES[CertificationLevel.Production];
  if (evidence.every((record) => score(record) >= production.minimumQualityScore && !record.degraded) && score(performance!) >= production.minimumQualityScore && score(runtime!) >= production.minimumQualityScore) return CertificationLevel.Production;
  if (evidence.every((record) => score(record) >= PLUGIN_CERTIFICATION_LEVEL_POLICIES[CertificationLevel.Qualified].minimumQualityScore)) return CertificationLevel.Qualified;
  if (evidence.every((record) => score(record) >= PLUGIN_CERTIFICATION_LEVEL_POLICIES[CertificationLevel.Development].minimumQualityScore)) return CertificationLevel.Development;
  return CertificationLevel.Experimental;
}
