export { ConfigurationAuthority, type ConfigurationAuthorityOptions } from './ConfigurationAuthority.js';
export { ConfigurationRegistry, DEFAULT_ENTRIES, CURRENT_SCHEMA_VERSION } from './registry.js';
export { validateEntries } from './validate.js';
export { runValidationPipeline, type PipelineContext, type PipelineCompatibility } from './pipeline.js';
export { CompatibilityRegistry, type CompatibilityChecker } from './compatibility.js';
export { resolveConfigValues, NoopSecretsProvider, type SecretsProvider, type LoadOptions, type ResolvedValue } from './sources.js';
export { createSnapshot, SnapshotStore } from './snapshot.js';
export { ProvenanceStore } from './provenance.js';
export { MigrationRunner, DEFAULT_MIGRATIONS } from './migrations.js';
export { CONFIG_EVENTS, ConfigEventBus, type ConfigEventName } from './events.js';
export { maskSensitiveValues, maskSingleValue, shouldMask, REDACTED } from './security.js';
export { AuditTrail } from './explainability.js';
export {
  ConfigurationError,
  ConfigurationValidationError,
  ConfigurationSyntaxError,
  ConfigurationRollbackError,
} from './errors.js';
export { registerPluginSchema, validatePluginConfig, type PluginConfigSchema } from './pluginConfig.js';
export type {
  ConfigCategory,
  ConfigDataType,
  ConfigEntry,
  ConfigSnapshot,
  ConfigSourceName,
  ConfigValues,
  RuntimeMutability,
  SecurityClassification,
  ValidationError,
  ValidationResult,
  ValidationStageName,
  ValidationStageResult,
  PipelineResult,
  AuditRecord,
  ProvenanceRecord,
  ProvenanceOverride,
  ProvenanceMigration,
  VersionInfo,
  MigrationDefinition,
  MigrationRecord,
} from './types.js';
