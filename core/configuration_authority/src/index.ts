export { ConfigurationAuthority, type ConfigurationAuthorityOptions } from './ConfigurationAuthority.js';
export { ConfigurationRegistry, DEFAULT_ENTRIES } from './registry.js';
export { validateAll, validateEntries } from './validate.js';
export { resolveConfigValues, NoopSecretsProvider, type SecretsProvider, type LoadOptions, type ResolvedValue } from './sources.js';
export { createSnapshot } from './snapshot.js';
export { CONFIG_EVENTS, ConfigEventBus, type ConfigEventName } from './events.js';
export { maskSensitiveValues, maskSingleValue, REDACTED } from './security.js';
export { AuditTrail } from './explainability.js';
export { ConfigurationError, ConfigurationValidationError } from './errors.js';
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
  AuditRecord,
} from './types.js';
