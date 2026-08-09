import { CertificationLevel } from './types.js';
/** Published deterministic thresholds used by levelAssignment; policy is data, not a manual override surface. */
export const PLUGIN_CERTIFICATION_LEVEL_POLICIES = Object.freeze({
  [CertificationLevel.Experimental]: Object.freeze({ minimumQualityScore: 0, requiresNoDegradation: false, requiresPerformanceAndRuntime: false, requiresInstitutionalCriticalEvidence: false }),
  [CertificationLevel.Development]: Object.freeze({ minimumQualityScore: 60, requiresNoDegradation: false, requiresPerformanceAndRuntime: false, requiresInstitutionalCriticalEvidence: false }),
  [CertificationLevel.Qualified]: Object.freeze({ minimumQualityScore: 75, requiresNoDegradation: false, requiresPerformanceAndRuntime: false, requiresInstitutionalCriticalEvidence: false }),
  [CertificationLevel.Production]: Object.freeze({ minimumQualityScore: 85, requiresNoDegradation: true, requiresPerformanceAndRuntime: true, requiresInstitutionalCriticalEvidence: false }),
  [CertificationLevel.InstitutionalCritical]: Object.freeze({ minimumQualityScore: 95, requiresNoDegradation: true, requiresPerformanceAndRuntime: true, requiresInstitutionalCriticalEvidence: true }),
});
