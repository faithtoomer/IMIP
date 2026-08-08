import { RecoveryPointNotFoundError } from './errors.js';
import type { RecoveryPoint, RecoveryPointDelta } from './types.js';

/**
 * §23 — Architect's Enhancement: the Institutional Recovery Graph (IRG),
 * built in full per explicit direction. Models relationships between
 * recovery points, platform versions, and per-domain schema versions —
 * real data captured at backup time (IDA's real `DomainSchema.version`
 * values, ICMS's real `platform.version`), not fabricated. Plugin/
 * Capability Registry version tracking is a real, ready extension point:
 * `domainSchemaVersions` already generalizes to any domain, including
 * those two once their registries exist and have real version concepts.
 */
export class InstitutionalRecoveryGraph {
  private recoveryPoints = new Map<string, RecoveryPoint>();

  registerRecoveryPoint(point: RecoveryPoint): void {
    this.recoveryPoints.set(point.recoveryPointId, point);
  }

  get(recoveryPointId: string): RecoveryPoint | undefined {
    return this.recoveryPoints.get(recoveryPointId);
  }

  require(recoveryPointId: string): RecoveryPoint {
    const point = this.recoveryPoints.get(recoveryPointId);
    if (!point) throw new RecoveryPointNotFoundError(recoveryPointId);
    return point;
  }

  all(): RecoveryPoint[] {
    return [...this.recoveryPoints.values()];
  }

  /** §23 example question: "which recovery point is compatible with the current platform version?" */
  compatibleWith(platformVersion: string): RecoveryPoint[] {
    return this.all().filter((point) => point.platformVersion === platformVersion && point.verificationStatus === 'verified');
  }

  /** §23 example question: "what changed between two recovery points?" */
  diff(fromId: string, toId: string): RecoveryPointDelta {
    const from = this.require(fromId);
    const to = this.require(toId);

    const domains = new Set([...Object.keys(from.domainSchemaVersions), ...Object.keys(to.domainSchemaVersions)]);
    const domainSchemaChanges = [...domains]
      .map((domain) => ({ domain, from: from.domainSchemaVersions[domain], to: to.domainSchemaVersions[domain] }))
      .filter((change) => change.from !== change.to);

    return {
      fromRecoveryPointId: fromId,
      toRecoveryPointId: toId,
      platformVersionChanged: from.platformVersion !== to.platformVersion,
      domainSchemaChanges,
    };
  }

  /** §23 example question: "can this backup safely restore onto the current runtime without schema migration?" */
  requiresMigration(recoveryPointId: string, currentSchemaVersions: Record<string, number>): boolean {
    const point = this.require(recoveryPointId);
    return Object.entries(point.domainSchemaVersions).some(
      ([domain, version]) => currentSchemaVersions[domain] !== undefined && currentSchemaVersions[domain] !== version,
    );
  }
}
