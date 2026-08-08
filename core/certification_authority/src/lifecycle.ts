import { CertificationLifecycleError } from './errors.js';
import type { CertificationLifecycleStage } from './types.js';

export const CERTIFICATION_LIFECYCLE: readonly CertificationLifecycleStage[] = Object.freeze([
  'discovered',
  'evaluated',
  'qualified',
  'certified',
  'production-approved',
  'recertified',
  'revoked',
]);

/**
 * `revoked` is reachable from every post-certified state. Expiration and denial
 * are statuses/audit conditions, deliberately not unapproved lifecycle stages.
 */
export const CERTIFICATION_LIFECYCLE_TRANSITIONS: Readonly<Record<CertificationLifecycleStage, readonly CertificationLifecycleStage[]>> = Object.freeze({
  discovered: ['evaluated'],
  evaluated: ['qualified'],
  qualified: ['certified'],
  certified: ['production-approved', 'revoked'],
  'production-approved': ['recertified', 'revoked'],
  recertified: ['revoked'],
  revoked: [],
});

export function assertCertificationLifecycleTransition(
  from: CertificationLifecycleStage | undefined,
  to: CertificationLifecycleStage,
): void {
  if (from === undefined && to === 'discovered') return;
  if (from !== undefined && CERTIFICATION_LIFECYCLE_TRANSITIONS[from].includes(to)) return;
  throw new CertificationLifecycleError(from, to);
}
