export type ConfigCategory =
  | 'platform'
  | 'hardware'
  | 'mining'
  | 'electricity'
  | 'wallet'
  | 'pools'
  | 'ai'
  | 'dashboard'
  | 'telemetry'
  | 'security'
  | 'database'
  | 'notifications'
  | 'plugins'
  | 'policies';

export type ConfigDataType = 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object';

/**
 * §13 — five-tier classification.
 * public       — freely visible everywhere
 * internal     — operational detail; visible in logs, excluded from external/public surfaces
 * confidential — masked in logs, telemetry, exceptions, explainability, provenance
 * restricted   — masked everywhere; never exported or displayed
 * secret       — masked everywhere; never exported, displayed, or included in telemetry
 * Masking threshold: confidential | restricted | secret are masked (see security.ts shouldMask).
 */
export type SecurityClassification = 'public' | 'internal' | 'confidential' | 'restricted' | 'secret';

/**
 * immutable            — fixed after first load; requestUpdate() always rejects
 * hot-reloadable        — may change on reload() without special authorization
 * authorized-update-only — may only change via requestUpdate() (approved update workflow, §17)
 */
export type RuntimeMutability = 'immutable' | 'hot-reloadable' | 'authorized-update-only';

export type ConfigValues = Record<string, unknown>;

export interface ConfigEntry {
  id: string;
  category: ConfigCategory;
  description: string;
  dataType: ConfigDataType;
  defaultValue: unknown;
  enumValues?: readonly unknown[];
  range?: { min?: number; max?: number };
  required?: boolean;
  owner: string;
  runtimeMutability: RuntimeMutability;
  versionIntroduced: string;
  versionDeprecated?: string;
  securityClassification: SecurityClassification;
  /** Cross-field / dependency validation (pipeline stage 5). Return an error message, or null if valid. */
  validate?: (value: unknown, allValues: Readonly<ConfigValues>) => string | null;
}

export interface ConfigSnapshot {
  readonly version: number;
  /** Content-addressed identifier (§11 "digitally identify snapshot"). */
  readonly id: string;
  readonly createdAt: string;
  readonly values: Readonly<ConfigValues>;
}

export type ConfigSourceName = 'cli' | 'env' | 'secrets' | 'file' | 'default';

export interface ValidationError {
  id: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** §10 — one of the nine ordered validation pipeline stages. */
export type ValidationStageName =
  | 'syntax'
  | 'schema'
  | 'type'
  | 'range'
  | 'cross-field'
  | 'authority-compatibility'
  | 'plugin-compatibility'
  | 'hardware-compatibility'
  | 'policy-compatibility';

export interface ValidationStageResult {
  name: ValidationStageName;
  errors: ValidationError[];
}

export interface PipelineResult extends ValidationResult {
  stages: ValidationStageResult[];
}

export interface AuditRecord {
  timestamp: string;
  id: string;
  previousValue: unknown;
  newValue: unknown;
  reason: string;
  initiatingAuthority: string;
  validationOutcome: 'valid' | 'invalid';
  approvalStatus: 'approved' | 'rejected';
}

/** §12 — per-key configuration provenance. */
export interface ProvenanceOverride {
  timestamp: string;
  previousValue: unknown;
  newValue: unknown;
  reason: string;
  initiatingAuthority: string;
}

export interface ProvenanceMigration {
  migrationId: string;
  timestamp: string;
  fromValue: unknown;
  toValue: unknown;
}

export interface ProvenanceRecord {
  id: string;
  currentValue: unknown;
  originalSource: ConfigSourceName;
  ownerAuthority: string;
  validationTimestamp: string;
  snapshotVersion: number;
  overrideHistory: ProvenanceOverride[];
  migrationHistory: ProvenanceMigration[];
  lastModified: string;
  validationResult: 'valid';
}

/** §14 — versioning. */
export interface VersionInfo {
  schemaVersion: string;
  runtimeVersion: string;
  compatibilityVersion: string;
  migrationVersion: string;
}

/** §15 — migration framework. */
export interface MigrationDefinition {
  id: string;
  fromSchemaVersion: string;
  toSchemaVersion: string;
  description: string;
  migrate: (values: ConfigValues) => ConfigValues;
}

export interface MigrationRecord {
  migrationId: string;
  fromSchemaVersion: string;
  toSchemaVersion: string;
  timestamp: string;
  affectedKeys: string[];
}
