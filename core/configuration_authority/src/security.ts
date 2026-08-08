import type { ConfigValues, SecurityClassification } from './types.js';
import type { ConfigurationRegistry } from './registry.js';

export const REDACTED = '[REDACTED]';

/**
 * §13 masking threshold: confidential, restricted, and secret values are masked
 * everywhere (logs, telemetry, exceptions, explainability, provenance). public
 * and internal values are not masked — internal is operational detail excluded
 * from external-facing surfaces by the consumer, not by ICMS redaction.
 */
export function shouldMask(classification: SecurityClassification): boolean {
  return classification === 'confidential' || classification === 'restricted' || classification === 'secret';
}

export function maskSensitiveValues(registry: ConfigurationRegistry, values: ConfigValues): ConfigValues {
  const masked: ConfigValues = {};
  for (const [id, value] of Object.entries(values)) {
    const entry = registry.get(id);
    masked[id] = entry && shouldMask(entry.securityClassification) ? REDACTED : value;
  }
  return masked;
}

export function maskSingleValue(registry: ConfigurationRegistry, id: string, value: unknown): unknown {
  const entry = registry.get(id);
  return entry && shouldMask(entry.securityClassification) ? REDACTED : value;
}
