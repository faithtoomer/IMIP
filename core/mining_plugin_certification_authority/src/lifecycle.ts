import { PluginCertificationLifecycleError } from './errors.js';
import { CertificationLifecycleStage } from './types.js';

const transitions: Readonly<Record<string, readonly CertificationLifecycleStage[]>> = {
  __initial__: [CertificationLifecycleStage.Submitted],
  [CertificationLifecycleStage.Submitted]: [CertificationLifecycleStage.Validated, CertificationLifecycleStage.Rejected],
  [CertificationLifecycleStage.Validated]: [CertificationLifecycleStage.Testing, CertificationLifecycleStage.Rejected, CertificationLifecycleStage.Failed],
  [CertificationLifecycleStage.Testing]: [CertificationLifecycleStage.EvidenceCollected, CertificationLifecycleStage.Failed, CertificationLifecycleStage.Rejected],
  [CertificationLifecycleStage.EvidenceCollected]: [CertificationLifecycleStage.Reviewed, CertificationLifecycleStage.Failed],
  [CertificationLifecycleStage.Reviewed]: [CertificationLifecycleStage.Certified, CertificationLifecycleStage.Failed, CertificationLifecycleStage.Rejected],
  [CertificationLifecycleStage.Certified]: [CertificationLifecycleStage.Active, CertificationLifecycleStage.Suspended, CertificationLifecycleStage.Revoked],
  [CertificationLifecycleStage.Active]: [CertificationLifecycleStage.Suspended, CertificationLifecycleStage.Revoked],
  [CertificationLifecycleStage.Suspended]: [CertificationLifecycleStage.Revoked, CertificationLifecycleStage.Recertified],
  [CertificationLifecycleStage.Revoked]: [CertificationLifecycleStage.Recertified],
  [CertificationLifecycleStage.Recertified]: [CertificationLifecycleStage.Submitted, CertificationLifecycleStage.Revoked],
};

export const PLUGIN_CERTIFICATION_LIFECYCLE = Object.freeze([
  CertificationLifecycleStage.Submitted, CertificationLifecycleStage.Validated, CertificationLifecycleStage.Testing,
  CertificationLifecycleStage.EvidenceCollected, CertificationLifecycleStage.Reviewed, CertificationLifecycleStage.Certified,
  CertificationLifecycleStage.Active,
]);

export function assertPluginCertificationLifecycleTransition(from: CertificationLifecycleStage | undefined, to: CertificationLifecycleStage): void {
  const permitted = transitions[from ?? '__initial__'] ?? [];
  if (!permitted.includes(to)) throw new PluginCertificationLifecycleError(from, to);
}
