import type { ConfigValues } from './types.js';
import type { ConfigurationRegistry } from './registry.js';

export const REDACTED = '[REDACTED]';

/**
 * §11 — sensitive values must never appear in logs, telemetry, exceptions, or
 * explainability records. This is the single masking function used by every
 * surface that could leak a sensitive value; callers must route through it
 * rather than re-implementing redaction locally.
 */
export function maskSensitiveValues(registry: ConfigurationRegistry, values: ConfigValues): ConfigValues {
  const masked: ConfigValues = {};
  for (const [id, value] of Object.entries(values)) {
    const entry = registry.get(id);
    masked[id] = entry?.securityClassification === 'sensitive' ? REDACTED : value;
  }
  return masked;
}

export function maskSingleValue(registry: ConfigurationRegistry, id: string, value: unknown): unknown {
  const entry = registry.get(id);
  return entry?.securityClassification === 'sensitive' ? REDACTED : value;
}
