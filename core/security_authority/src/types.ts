/** §6 — trust is ordinal: untrusted (0) is the default for anything not
 * explicitly registered — Law 2 "Zero Implicit Trust". */
export type TrustLevel = 'untrusted' | 'basic' | 'verified' | 'certified' | 'core';

export const TRUST_LEVEL_RANK: Record<TrustLevel, number> = {
  untrusted: 0,
  basic: 1,
  verified: 2,
  certified: 3,
  core: 4,
};

export type CertificationStatus = 'uncertified' | 'pending' | 'certified' | 'revoked';

/** §11/§6 — "(future)": no PKI/signing infrastructure exists on this
 * platform yet. `unsigned` is the honest default, never fabricated. */
export type SignatureStatus = 'unsigned' | 'signed' | 'verified' | 'invalid';

export type RiskClassification = 'low' | 'medium' | 'high' | 'critical';

export type ComponentType = 'authority' | 'plugin' | 'operator' | 'remote-agent' | (string & {});

/** §6 — the authoritative Trust Registry entry. */
export interface TrustRecord {
  componentId: string;
  componentType: ComponentType;
  identity: string;
  trustLevel: TrustLevel;
  certificationStatus: CertificationStatus;
  signatureStatus: SignatureStatus;
  publisher?: string;
  lastValidation: string;
  securityProfile?: Record<string, unknown>;
  riskClassification: RiskClassification;
  createdAt: string;
}

export type TrustRegistrationInput = Omit<TrustRecord, 'lastValidation' | 'createdAt' | 'signatureStatus'> & {
  signatureStatus?: SignatureStatus;
};

/** §7 — a registered, governable permission. */
export interface PermissionDefinition {
  permissionId: string;
  category: string;
  description: string;
}

export interface Role {
  roleId: string;
  description: string;
  permissionIds: string[];
}

/** §9 — a grant is either a role (bundle of permissions) or a single direct
 * permission — both are real RBAC primitives, not fabricated. */
export interface Grant {
  grantId: string;
  componentId: string;
  roleId?: string;
  permissionId?: string;
  grantedAt: string;
  grantedBy: string;
  expiresAt?: string;
}

export interface AuthorizationRequest {
  componentId: string;
  permissionId: string;
  operation: string;
  /** §9 "ABAC readiness" — attributes an optional AttributePolicy may evaluate. */
  context?: Record<string, unknown>;
  correlationId?: string;
  traceId?: string;
}

/** §14 — every field the spec's explainability list requires. */
export interface AuthorizationDecision {
  decisionId: string;
  componentId: string;
  permissionId: string;
  operation: string;
  approved: boolean;
  reasons: string[];
  trustLevel: TrustLevel;
  policyEvaluated?: string;
  timestamp: string;
  correlationId?: string;
  traceId?: string;
}

/** §9 — a real, generic ABAC-readiness extension point. No default
 * attribute rules exist (no real attribute data source yet) — this is
 * "readiness," not a claim of full ABAC, matching the spec's own wording. */
export interface AttributePolicy {
  name: string;
  evaluate(request: AuthorizationRequest): { approved: boolean; reasons: string[] };
}

/** §11 — "(future)": no signing/PKI infrastructure exists yet. */
export interface SignatureVerifier {
  verify(payload: Buffer, signature: Buffer, publicKey: string): { verified: boolean; reason: string };
}

/** §8 — secret metadata only; the actual secret bytes never appear here. */
export interface SecretRecord {
  secretId: string;
  category: string;
  createdAt: string;
  lastRotatedAt: string;
  lastAccessedAt?: string;
  accessCount: number;
}

/** §12 — every field the spec's audit-record list requires. */
export interface SecurityAuditRecord {
  auditId: string;
  timestamp: string;
  componentId: string;
  operation: string;
  permissionId?: string;
  trustLevel?: TrustLevel;
  decision: 'approved' | 'denied' | 'error';
  policyUsed?: string;
  correlationId?: string;
  traceId?: string;
  reason?: string;
}

export interface SecurityMetrics {
  authorizationCount: number;
  authorizationDenials: number;
  averageAuthorizationLatencyMs: number;
  secretRetrievalCount: number;
  averageSecretRetrievalLatencyMs: number;
  securityViolationCount: number;
  trustValidationCount: number;
}

/** §13 — the 11 named events. */
export const SECURITY_EVENTS = {
  PermissionGranted: 'PermissionGranted',
  PermissionDenied: 'PermissionDenied',
  TrustEstablished: 'TrustEstablished',
  TrustRevoked: 'TrustRevoked',
  SecretAccessed: 'SecretAccessed',
  SecretRotated: 'SecretRotated',
  PolicyUpdated: 'PolicyUpdated',
  SecurityWarning: 'SecurityWarning',
  SecurityViolation: 'SecurityViolation',
  CredentialExpired: 'CredentialExpired',
  AuthorizationFailed: 'AuthorizationFailed',
} as const;

export type SecurityEventName = (typeof SECURITY_EVENTS)[keyof typeof SECURITY_EVENTS];

/** §22 — a single finding contributing to the Institutional Security
 * Posture Model's aggregate score. */
export interface PostureFinding {
  category: 'trust' | 'permission' | 'secret' | 'audit';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  componentId?: string;
}

export interface SecurityPosture {
  generatedAt: string;
  score: number;
  findings: PostureFinding[];
}
