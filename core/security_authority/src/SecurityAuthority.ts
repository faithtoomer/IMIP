import { randomUUID } from 'node:crypto';
import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import type { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import { TrustRegistry } from './trustRegistry.js';
import { PermissionRegistry, DEFAULT_PERMISSIONS } from './permissionRegistry.js';
import { SecretVault } from './secretVault.js';
import { SecurityAuditTrail } from './auditTrail.js';
import { SecurityEventBus } from './events.js';
import { InstitutionalSecurityPostureModel } from './posture.js';
import { AccessDeniedError } from './errors.js';
import { SECURITY_EVENTS, TRUST_LEVEL_RANK } from './types.js';
import type {
  AttributePolicy,
  AuthorizationDecision,
  AuthorizationRequest,
  Grant,
  PermissionDefinition,
  Role,
  SecretRecord,
  SecurityAuditRecord,
  SecurityEventName,
  SecurityMetrics,
  TrustLevel,
  TrustRecord,
  TrustRegistrationInput,
} from './types.js';

export interface SecurityAuthorityOptions {
  eventBus?: InstitutionalEventBus;
  observabilityAuthority?: ObservabilityAuthority;
  /** Bootstraps the Secret Vault's encryption key (typically sourced from an
   * environment variable at the process boundary). Omitting it leaves
   * Trust/Permission/Audit/Crypto services usable but secret storage
   * unavailable — see SecretVault. */
  masterKey?: string;
  permissions?: PermissionDefinition[];
  attributePolicies?: AttributePolicy[];
  /** Law 2 "Zero Implicit Trust" — the minimum trust level required for any
   * authorization to succeed, regardless of granted permissions. */
  minimumTrustLevel?: TrustLevel;
  now?: () => Date;
}

const LOG_CATEGORY = 'security';
const NON_IEB_LOG_OPERATIONS = ['grant-revoked'];

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * ISTA — the Institutional Security & Trust Authority (PHASE-12). The sole
 * authority for security governance, trust evaluation, authorization,
 * secret management, and security auditing. "Authorization" here means
 * access control (is this caller allowed to invoke this operation) — a
 * deliberately distinct concept from `DECISION_PIPELINE.md` stage 9
 * "Authorization" (owned by Decision Intelligence Authority, gating whether
 * a specific mining decision proceeds). See ADR-0015.
 *
 * Every public decision method (`authorize`, `retrieveSecret`, etc.) is
 * synchronous, mirroring events onto the IEB (ADR-0009 §6 pattern) rather
 * than publishing directly — unlike ISOA/IRBLM, ISTA is meant to be
 * callable inline from any other authority's own synchronous methods.
 */
export class SecurityAuthority {
  readonly trust = new TrustRegistry();
  readonly permissions: PermissionRegistry;
  readonly audit = new SecurityAuditTrail();
  readonly posture: InstitutionalSecurityPostureModel;
  readonly events: SecurityEventBus;

  private readonly vault: SecretVault;
  private readonly attributePolicies: AttributePolicy[];
  private readonly minimumTrustLevel: TrustLevel;
  private readonly observability?: ObservabilityAuthority;
  private readonly now: () => Date;
  private readonly notifiedExpiredGrants = new Set<string>();

  private authorizationCount = 0;
  private authorizationDenials = 0;
  private secretRetrievalCount = 0;
  private securityViolationCount = 0;
  private trustValidationCount = 0;
  private readonly authorizationDurations: number[] = [];
  private readonly secretRetrievalDurations: number[] = [];

  constructor(options: SecurityAuthorityOptions = {}) {
    this.permissions = new PermissionRegistry(options.permissions ?? DEFAULT_PERMISSIONS);
    this.vault = new SecretVault(options.masterKey);
    this.events = new SecurityEventBus(options.eventBus);
    this.observability = options.observabilityAuthority;
    this.attributePolicies = options.attributePolicies ?? [];
    this.minimumTrustLevel = options.minimumTrustLevel ?? 'basic';
    this.now = options.now ?? (() => new Date());
    this.posture = new InstitutionalSecurityPostureModel(
      () => this.trust.all(),
      () => this.vault.allMetadata(),
      () => this.audit.all(),
    );

    if (this.observability) {
      for (const name of Object.values(SECURITY_EVENTS)) {
        if (!this.observability.schemas.get(LOG_CATEGORY, name)) {
          this.observability.registerSchema({ category: LOG_CATEGORY, operation: name, description: `ISTA event: ${name}` });
        }
      }
      for (const operation of NON_IEB_LOG_OPERATIONS) {
        if (!this.observability.schemas.get(LOG_CATEGORY, operation)) {
          this.observability.registerSchema({ category: LOG_CATEGORY, operation, description: `ISTA operation: ${operation}` });
        }
      }
    }
  }

  // ---- Trust (§6, Law 2) ----

  registerTrust(input: TrustRegistrationInput): TrustRecord {
    const record = this.trust.register(input);
    this.publish(SECURITY_EVENTS.TrustEstablished, { componentId: record.componentId, trustLevel: record.trustLevel });
    return record;
  }

  revokeTrust(componentId: string, reason: string, initiatingAuthority: string): TrustRecord {
    const record = this.trust.revoke(componentId);
    this.recordAudit({ componentId, operation: 'revoke-trust', decision: 'approved', reason });
    this.publish(SECURITY_EVENTS.TrustRevoked, { componentId, reason, initiatingAuthority });
    return record;
  }

  validateTrust(componentId: string): TrustRecord | undefined {
    this.trustValidationCount += 1;
    const record = this.trust.get(componentId);
    if (record) this.trust.update({ ...record, lastValidation: this.now().toISOString() });
    return this.trust.get(componentId);
  }

  // ---- Permissions / Roles / Grants (§7, §9) ----

  registerPermission(permission: PermissionDefinition): void {
    this.permissions.registerPermission(permission);
  }

  registerRole(role: Role): void {
    this.permissions.registerRole(role);
  }

  grant(componentId: string, options: { roleId?: string; permissionId?: string; grantedBy: string; expiresAt?: string }): Grant {
    const grant: Grant = {
      grantId: randomUUID(),
      componentId,
      roleId: options.roleId,
      permissionId: options.permissionId,
      grantedAt: this.now().toISOString(),
      grantedBy: options.grantedBy,
      expiresAt: options.expiresAt,
    };
    this.permissions.grant(grant);
    this.publish(SECURITY_EVENTS.PermissionGranted, { grantId: grant.grantId, componentId, roleId: grant.roleId, permissionId: grant.permissionId });
    return grant;
  }

  /** §13 — no "PermissionRevoked" event exists in the spec's 11-name list;
   * logged through IOLA only (operation `grant-revoked`), not fabricated as
   * an IEB event. Mirrors ISOA's pause/resume precedent (ADR-0014 §8). */
  revokeGrant(grantId: string, reason: string, initiatingAuthority: string): Grant {
    const grant = this.permissions.revokeGrant(grantId);
    this.logOnly('grant-revoked', { grantId, reason, initiatingAuthority });
    return grant;
  }

  // ---- Authorization (§9, §14, Law 3) ----

  /** Deny-by-default: an unknown component, an untrusted component, a
   * missing grant, or a failing attribute policy all result in `approved:
   * false`. An unregistered `permissionId` is an `AuthorizationFailed`
   * error, not a normal denial — the request itself is malformed. */
  authorize(request: AuthorizationRequest): AuthorizationDecision {
    const start = performance.now();
    const now = this.now();
    const decisionId = randomUUID();
    const reasons: string[] = [];

    if (!this.permissions.hasPermission(request.permissionId)) {
      this.publish(SECURITY_EVENTS.AuthorizationFailed, { componentId: request.componentId, permissionId: request.permissionId });
      this.recordAudit({
        componentId: request.componentId,
        operation: request.operation,
        permissionId: request.permissionId,
        decision: 'error',
        reason: `Unregistered permission "${request.permissionId}".`,
        correlationId: request.correlationId,
        traceId: request.traceId,
      });
      return this.finish(decisionId, request, false, [`Unregistered permission "${request.permissionId}".`], 'untrusted', now, start);
    }

    const trustRecord = this.trust.get(request.componentId);
    const trustLevel: TrustLevel = trustRecord?.trustLevel ?? 'untrusted';
    if (TRUST_LEVEL_RANK[trustLevel] < TRUST_LEVEL_RANK[this.minimumTrustLevel]) {
      reasons.push(
        trustRecord
          ? `Trust level "${trustLevel}" is below the required minimum "${this.minimumTrustLevel}".`
          : `Component "${request.componentId}" has no trust record — Law 2 "Zero Implicit Trust".`,
      );
    }

    if (reasons.length === 0 && !this.permissions.hasEffectivePermission(request.componentId, request.permissionId, now)) {
      reasons.push(`No active grant covers permission "${request.permissionId}".`);
    }

    if (reasons.length === 0) {
      for (const policy of this.attributePolicies) {
        const result = policy.evaluate(request);
        if (!result.approved) reasons.push(...result.reasons);
      }
    }

    const approved = reasons.length === 0;
    this.publish(approved ? SECURITY_EVENTS.PermissionGranted : SECURITY_EVENTS.PermissionDenied, {
      componentId: request.componentId,
      permissionId: request.permissionId,
      reasons,
    });
    this.recordAudit({
      componentId: request.componentId,
      operation: request.operation,
      permissionId: request.permissionId,
      trustLevel,
      decision: approved ? 'approved' : 'denied',
      reason: approved ? undefined : reasons.join('; '),
      correlationId: request.correlationId,
      traceId: request.traceId,
    });

    return this.finish(decisionId, request, approved, reasons, trustLevel, now, start);
  }

  private finish(
    decisionId: string,
    request: AuthorizationRequest,
    approved: boolean,
    reasons: string[],
    trustLevel: TrustLevel,
    now: Date,
    perfStart: number,
  ): AuthorizationDecision {
    this.authorizationCount += 1;
    if (!approved) this.authorizationDenials += 1;
    this.authorizationDurations.push(performance.now() - perfStart);
    return {
      decisionId,
      componentId: request.componentId,
      permissionId: request.permissionId,
      operation: request.operation,
      approved,
      reasons,
      trustLevel,
      timestamp: now.toISOString(),
      correlationId: request.correlationId,
      traceId: request.traceId,
    };
  }

  // ---- Secret Management (§8, Law 4) ----

  storeSecret(secretId: string, category: string, value: string, componentId: string): SecretRecord {
    this.requireAuthorized(componentId, 'secret.manage', 'store-secret');
    return this.vault.store(secretId, category, value);
  }

  retrieveSecret(secretId: string, componentId: string): string {
    const start = performance.now();
    this.requireAuthorized(componentId, 'secret.access', 'retrieve-secret');
    const value = this.vault.retrieve(secretId);
    this.secretRetrievalCount += 1;
    this.secretRetrievalDurations.push(performance.now() - start);
    this.publish(SECURITY_EVENTS.SecretAccessed, { secretId, componentId });
    return value;
  }

  rotateSecret(secretId: string, newValue: string, componentId: string): SecretRecord {
    this.requireAuthorized(componentId, 'secret.manage', 'rotate-secret');
    const record = this.vault.rotate(secretId, newValue);
    this.publish(SECURITY_EVENTS.SecretRotated, { secretId, componentId });
    return record;
  }

  secretMetadata(secretId: string): SecretRecord | undefined {
    return this.vault.metadataFor(secretId);
  }

  private requireAuthorized(componentId: string, permissionId: string, operation: string): void {
    const decision = this.authorize({ componentId, permissionId, operation });
    if (!decision.approved) throw new AccessDeniedError(componentId, permissionId, decision.reasons);
  }

  // ---- Expiry & security reporting (§13) ----

  /** Real, callable expiry sweep — publishes `CredentialExpired` once per
   * newly-expired grant (not repeatedly on every call). */
  checkExpiredGrants(componentIds: string[]): void {
    const now = this.now();
    for (const componentId of componentIds) {
      for (const grant of this.permissions.grantsFor(componentId)) {
        if (!grant.expiresAt || new Date(grant.expiresAt).getTime() > now.getTime()) continue;
        if (this.notifiedExpiredGrants.has(grant.grantId)) continue;
        this.notifiedExpiredGrants.add(grant.grantId);
        this.publish(SECURITY_EVENTS.CredentialExpired, { grantId: grant.grantId, componentId });
      }
    }
  }

  reportSecurityWarning(message: string, componentId: string | undefined, initiatingAuthority: string): void {
    this.recordAudit({ componentId: componentId ?? 'platform', operation: 'security-warning', decision: 'approved', reason: message });
    this.publish(SECURITY_EVENTS.SecurityWarning, { message, componentId, initiatingAuthority });
  }

  reportSecurityViolation(message: string, componentId: string | undefined, initiatingAuthority: string): void {
    this.securityViolationCount += 1;
    this.recordAudit({ componentId: componentId ?? 'platform', operation: 'security-violation', decision: 'denied', reason: message });
    this.publish(SECURITY_EVENTS.SecurityViolation, { message, componentId, initiatingAuthority });
  }

  reportPolicyUpdated(policyName: string, initiatingAuthority: string): void {
    this.publish(SECURITY_EVENTS.PolicyUpdated, { policyName, initiatingAuthority });
  }

  // ---- Explainability (§14) ----

  explain(componentId: string): {
    trust?: TrustRecord;
    grants: Grant[];
    recentAudit: SecurityAuditRecord[];
    findings: ReturnType<InstitutionalSecurityPostureModel['evaluate']>['findings'];
  } {
    return {
      trust: this.trust.get(componentId),
      grants: this.permissions.grantsFor(componentId),
      recentAudit: this.audit.forComponent(componentId),
      findings: this.posture.evaluate().findings.filter((finding) => finding.componentId === componentId || !finding.componentId),
    };
  }

  getMetrics(): SecurityMetrics {
    return {
      authorizationCount: this.authorizationCount,
      authorizationDenials: this.authorizationDenials,
      averageAuthorizationLatencyMs: average(this.authorizationDurations),
      secretRetrievalCount: this.secretRetrievalCount,
      averageSecretRetrievalLatencyMs: average(this.secretRetrievalDurations),
      securityViolationCount: this.securityViolationCount,
      trustValidationCount: this.trustValidationCount,
    };
  }

  // ---- Internal ----

  private recordAudit(entry: Omit<SecurityAuditRecord, 'auditId' | 'timestamp'>): void {
    this.audit.record({ auditId: randomUUID(), timestamp: this.now().toISOString(), ...entry });
  }

  private publish(name: SecurityEventName, payload: unknown): void {
    this.events.publish(name, payload);
    this.logOnly(name, payload);
  }

  private logOnly(operation: string, payload: unknown): void {
    if (!this.observability) return;
    try {
      this.observability.log({
        severity:
          operation === SECURITY_EVENTS.SecurityViolation || operation === SECURITY_EVENTS.AuthorizationFailed
            ? 'error'
            : operation === SECURITY_EVENTS.SecurityWarning || operation === SECURITY_EVENTS.PermissionDenied
              ? 'warning'
              : 'audit',
        category: LOG_CATEGORY,
        authority: 'Security & Trust Authority',
        operation,
        message: operation,
        context: payload as Record<string, unknown>,
      });
    } catch {
      // Observability is a diagnostic concern, never a functional dependency.
    }
  }
}
