import type { PostureFinding, SecretRecord, SecurityAuditRecord, SecurityPosture, TrustRecord } from './types.js';

const DEFAULT_ROTATION_WARNING_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const DEFAULT_ROTATION_CRITICAL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
const RECENT_VIOLATION_WINDOW = 50; // look at the most recent N audit records

/**
 * §22 — Architect's Enhancement: the Institutional Security Posture Model
 * (ISPM), built in full per explicit, unambiguous direction ("I recommend
 * adding from the beginning" — unlike Phase 10/11's genuinely ambiguous
 * "reserve from the beginning" wording, this needed no clarification).
 *
 * Aggregates real, already-tracked state — trust levels, secret rotation
 * age, recent audit denials/violations — into a single explainable score.
 * It does not replace authorization decisions (§22 is explicit about this):
 * it is a read-only, higher-level assessment layered on top of them.
 */
export class InstitutionalSecurityPostureModel {
  constructor(
    private readonly trustRecords: () => TrustRecord[],
    private readonly secretRecords: () => SecretRecord[],
    private readonly auditRecords: () => readonly SecurityAuditRecord[],
  ) {}

  evaluate(): SecurityPosture {
    const findings: PostureFinding[] = [
      ...this.trustFindings(),
      ...this.secretFindings(),
      ...this.auditFindings(),
    ];
    const score = this.computeScore(findings);
    return { generatedAt: new Date().toISOString(), score, findings };
  }

  /** §22 example question: "which credentials require rotation?" */
  credentialsRequiringRotation(maxAgeMs: number = DEFAULT_ROTATION_WARNING_MS): SecretRecord[] {
    const now = Date.now();
    return this.secretRecords().filter((record) => now - new Date(record.lastRotatedAt).getTime() > maxAgeMs);
  }

  /** §22 example question: "which plugin or authority reduced the overall trust score?" */
  lowestTrustComponents(): TrustRecord[] {
    return this.trustRecords()
      .filter((record) => record.trustLevel === 'untrusted' || record.certificationStatus === 'revoked')
      .sort((a, b) => a.componentId.localeCompare(b.componentId));
  }

  /** §22 example question: "why was a component denied access despite having a valid identity?" */
  whyDenied(componentId: string): SecurityAuditRecord[] {
    return this.auditRecords().filter((record) => record.componentId === componentId && record.decision === 'denied');
  }

  private trustFindings(): PostureFinding[] {
    const findings: PostureFinding[] = [];
    for (const record of this.trustRecords()) {
      if (record.certificationStatus === 'revoked') {
        findings.push({ category: 'trust', severity: 'critical', message: `"${record.componentId}" has a revoked certification.`, componentId: record.componentId });
      } else if (record.trustLevel === 'untrusted') {
        findings.push({ category: 'trust', severity: 'warning', message: `"${record.componentId}" is untrusted.`, componentId: record.componentId });
      }
      if (record.riskClassification === 'critical') {
        findings.push({ category: 'trust', severity: 'critical', message: `"${record.componentId}" is classified as critical risk.`, componentId: record.componentId });
      }
    }
    return findings;
  }

  private secretFindings(): PostureFinding[] {
    const findings: PostureFinding[] = [];
    const now = Date.now();
    for (const record of this.secretRecords()) {
      const age = now - new Date(record.lastRotatedAt).getTime();
      if (age > DEFAULT_ROTATION_CRITICAL_MS) {
        findings.push({ category: 'secret', severity: 'critical', message: `Secret "${record.secretId}" has not been rotated in over 180 days.` });
      } else if (age > DEFAULT_ROTATION_WARNING_MS) {
        findings.push({ category: 'secret', severity: 'warning', message: `Secret "${record.secretId}" has not been rotated in over 90 days.` });
      }
    }
    return findings;
  }

  private auditFindings(): PostureFinding[] {
    const recent = this.auditRecords().slice(-RECENT_VIOLATION_WINDOW);
    const denials = recent.filter((record) => record.decision === 'denied').length;
    const findings: PostureFinding[] = [];
    if (denials > 0) {
      findings.push({ category: 'audit', severity: denials >= 5 ? 'critical' : 'info', message: `${denials} access denial(s) among the last ${recent.length} audit records.` });
    }
    return findings;
  }

  private computeScore(findings: PostureFinding[]): number {
    let score = 100;
    for (const finding of findings) {
      score -= finding.severity === 'critical' ? 20 : finding.severity === 'warning' ? 5 : 1;
    }
    return Math.max(0, Math.min(100, score));
  }
}
