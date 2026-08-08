import type { CertificationResult, ComponentDefinition } from './types.js';
import { RuntimeGovernanceBoard } from './governanceBoard.js';

/**
 * §10 — Runtime Certification. Generic by design: rather than hardcoding
 * checks for named authorities (Configuration valid, Capability Registry
 * available, ...), certification requires every *registered* component to
 * be ready and not faulted. Components that don't exist yet (Capability
 * Registry, Plugin Registry, Policy Engine — all still reserved) are simply
 * absent from the graph and impose no certification requirement; the moment
 * they're registered as real components, they participate automatically,
 * with no change to this module.
 *
 * A component in 'degraded' health does not block certification — the
 * Governance Board's job is precisely to keep such components visible
 * (§22 "degraded but still operational") rather than treating degraded as
 * equivalent to faulted.
 */
export function certifyRuntime(
  definitions: ComponentDefinition<any>[],
  board: RuntimeGovernanceBoard,
): CertificationResult {
  const checkedAt = new Date().toISOString();
  const componentResults: CertificationResult['componentResults'] = [];
  const reasons: string[] = [];

  for (const definition of definitions) {
    const record = board.ensure(definition.name);
    const blocking = !record.readinessStatus.ready || record.healthStatus.status === 'faulted';

    componentResults.push({
      name: definition.name,
      ready: record.readinessStatus.ready,
      health: record.healthStatus.status,
      blocking,
    });

    if (blocking) {
      if (!record.readinessStatus.ready) {
        reasons.push(`"${definition.name}" is not ready: ${record.readinessStatus.reasons.join('; ') || 'unknown reason'}.`);
      }
      if (record.healthStatus.status === 'faulted') {
        reasons.push(`"${definition.name}" is faulted: ${record.healthStatus.reasons.join('; ') || 'unknown reason'}.`);
      }
    }

    board.updateCertification(definition.name, blocking ? 'blocked' : 'certified');
  }

  return { certified: reasons.length === 0, checkedAt, componentResults, reasons };
}
