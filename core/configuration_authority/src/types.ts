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

export type SecurityClassification = 'public' | 'sensitive';

/**
 * immutable            — fixed after first load; requestUpdate() always rejects
 * hot-reloadable        — may change on reload() without special authorization
 * authorized-update-only — may only change via requestUpdate() (approved update workflow, §9)
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
  /** Cross-field / dependency validation. Return an error message, or null if valid. */
  validate?: (value: unknown, allValues: Readonly<ConfigValues>) => string | null;
}

export interface ConfigSnapshot {
  readonly version: number;
  readonly createdAt: string;
  readonly values: Readonly<ConfigValues>;
}

export type ConfigSourceName = 'cli' | 'env' | 'file' | 'secrets' | 'default';

export interface ValidationError {
  id: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
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
