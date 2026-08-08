import type { GovernanceRecord, HealthCheckResult, ReadinessCheckResult } from './types.js';

const UNINITIALIZED_READINESS: ReadinessCheckResult = { ready: false, reasons: ['not yet initialized'] };
const UNKNOWN_HEALTH: HealthCheckResult = { status: 'unknown', reasons: ['not yet checked'] };

/**
 * §22 — Architect's Enhancement: Runtime Governance Board. A continuously
 * updated governance view over every registered component, independent of
 * the one-time boot sequence — answers "why is X unavailable," "which
 * component blocked Operational," "what's degraded but still running,"
 * at any point in the platform's lifetime, not just at startup.
 */
export class RuntimeGovernanceBoard {
  private records = new Map<string, GovernanceRecord>();

  ensure(name: string): GovernanceRecord {
    let record = this.records.get(name);
    if (!record) {
      record = {
        name,
        lifecycleState: 'unregistered',
        readinessStatus: UNINITIALIZED_READINESS,
        healthStatus: UNKNOWN_HEALTH,
        dependencyStatus: { satisfied: true, missing: [] },
        certificationStatus: 'pending',
        restartCount: 0,
        operationalEligible: false,
      };
      this.records.set(name, record);
    }
    return record;
  }

  markCreated(name: string): void {
    this.ensure(name).lifecycleState = 'created';
  }

  markInitializing(name: string): void {
    this.ensure(name).lifecycleState = 'initializing';
  }

  markInitialized(name: string, timestamp: string): void {
    const record = this.ensure(name);
    record.lifecycleState = 'initialized';
    record.lastSuccessfulInitialization = timestamp;
  }

  markFailed(name: string, message: string, timestamp: string): void {
    const record = this.ensure(name);
    record.lifecycleState = 'failed';
    record.lastFailure = { timestamp, message };
    record.operationalEligible = false;
  }

  markShutdown(name: string): void {
    this.ensure(name).lifecycleState = 'shutdown';
  }

  recordRestart(name: string): void {
    this.ensure(name).restartCount += 1;
  }

  updateReadiness(name: string, readiness: ReadinessCheckResult): void {
    this.ensure(name).readinessStatus = readiness;
  }

  updateHealth(name: string, health: HealthCheckResult): void {
    this.ensure(name).healthStatus = health;
  }

  updateDependencyStatus(name: string, satisfied: boolean, missing: string[]): void {
    this.ensure(name).dependencyStatus = { satisfied, missing };
  }

  updateCertification(name: string, status: GovernanceRecord['certificationStatus']): void {
    const record = this.ensure(name);
    record.certificationStatus = status;
    record.operationalEligible =
      status === 'certified' && record.readinessStatus.ready && record.healthStatus.status !== 'faulted';
  }

  get(name: string): GovernanceRecord | undefined {
    return this.records.get(name);
  }

  all(): GovernanceRecord[] {
    return [...this.records.values()];
  }

  /** §22 — "Why is X unavailable?" */
  whyUnavailable(name: string): string[] {
    const record = this.records.get(name);
    if (!record) return [`"${name}" is not registered with the runtime.`];
    if (record.operationalEligible) return [];

    const reasons: string[] = [];
    if (!record.dependencyStatus.satisfied) {
      reasons.push(`Missing dependencies: ${record.dependencyStatus.missing.join(', ')}.`);
    }
    if (!record.readinessStatus.ready) {
      reasons.push(...record.readinessStatus.reasons);
    }
    if (record.healthStatus.status === 'faulted') {
      reasons.push(...record.healthStatus.reasons);
    }
    if (record.lastFailure) {
      reasons.push(`Last failure: ${record.lastFailure.message}`);
    }
    if (record.certificationStatus !== 'certified') {
      reasons.push(`Certification status: ${record.certificationStatus}.`);
    }
    return reasons.length > 0 ? reasons : ['Not yet operationally eligible.'];
  }

  /** §22 — "Which component(s) prevented Operational state?" */
  blockingComponents(): string[] {
    return this.all()
      .filter((record) => !record.operationalEligible && record.lifecycleState !== 'shutdown')
      .map((record) => record.name);
  }

  /** §22 — "Which components are degraded but still operational?" */
  degradedComponents(): string[] {
    return this.all()
      .filter((record) => record.healthStatus.status === 'degraded' && record.operationalEligible)
      .map((record) => record.name);
  }
}
