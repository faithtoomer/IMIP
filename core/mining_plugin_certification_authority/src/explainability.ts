import type { EvidenceRecord, PluginCertificationRecord } from './types.js';
export function explainPluginCertification(record: PluginCertificationRecord, evidence: readonly EvidenceRecord[]) {
  const failed = record.pipelineResults.filter((result) => !result.passed);
  return {
    plugin: { pluginUuid: record.pluginUuid, version: record.version },
    certification: { certificationId: record.certificationId, level: record.certificationLevel, stage: record.lifecycleStage },
    evidenceEvaluated: evidence.map((entry) => ({ evidenceId: entry.evidenceId, stage: entry.stage, type: entry.type, passed: entry.passed })),
    testsPassed: record.pipelineResults.filter((result) => result.passed).map((result) => result.stage),
    testsFailed: failed.map((result) => ({ stage: result.stage, rationale: result.rationale })),
    lifecycle: record.lifecycle.map((entry) => `${entry.from ?? 'none'} -> ${entry.to}: ${entry.reason}`),
    decisionRationale: record.decisionReason ?? (failed.length ? failed.map((result) => result.rationale).join('; ') : `Certification is ${record.lifecycleStage}.`),
  };
}
