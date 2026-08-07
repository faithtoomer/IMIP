import type { ConfigEntry, ConfigValues, ValidationError, ValidationResult } from './types.js';
import type { ConfigurationRegistry } from './registry.js';

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'object';
  return typeof value;
}

/** Validates a fixed set of entries against a candidate value set. Unknown-key rejection is the caller's responsibility (see validateAll). */
export function validateEntries(entries: ConfigEntry[], values: ConfigValues): ValidationResult {
  const errors: ValidationError[] = [];

  for (const entry of entries) {
    const has = Object.prototype.hasOwnProperty.call(values, entry.id);
    const raw = has ? values[entry.id] : entry.defaultValue;

    if (entry.required && raw === undefined) {
      errors.push({ id: entry.id, message: `Required configuration value "${entry.id}" is missing.` });
      continue;
    }

    if (raw === undefined || raw === null) continue;

    const actualType = typeOf(raw);
    const expectedType = entry.dataType === 'enum' ? typeof raw : entry.dataType;

    if (entry.dataType !== 'enum' && actualType !== entry.dataType) {
      errors.push({
        id: entry.id,
        message: `"${entry.id}" expected type ${entry.dataType}, got ${actualType}.`,
      });
      continue;
    }

    if (entry.dataType === 'enum') {
      if (entry.enumValues && !entry.enumValues.includes(raw)) {
        errors.push({
          id: entry.id,
          message: `"${entry.id}" must be one of [${entry.enumValues.join(', ')}], got "${String(raw)}".`,
        });
        continue;
      }
      void expectedType;
    }

    if (entry.dataType === 'number' && entry.range) {
      const n = raw as number;
      if (entry.range.min !== undefined && n < entry.range.min) {
        errors.push({ id: entry.id, message: `"${entry.id}" (${n}) is below minimum ${entry.range.min}.` });
      }
      if (entry.range.max !== undefined && n > entry.range.max) {
        errors.push({ id: entry.id, message: `"${entry.id}" (${n}) is above maximum ${entry.range.max}.` });
      }
    }

    if (entry.validate) {
      const message = entry.validate(raw, values);
      if (message) errors.push({ id: entry.id, message });
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Full-registry validation: validates every registered entry and rejects any unregistered key (SSOT enforcement). */
export function validateAll(registry: ConfigurationRegistry, values: ConfigValues): ValidationResult {
  const known = validateEntries(registry.all(), values);
  const unknown: ValidationError[] = [];

  for (const key of Object.keys(values)) {
    if (!registry.get(key)) {
      unknown.push({
        id: key,
        message: `Unknown configuration key "${key}" is not registered with the Configuration Authority.`,
      });
    }
  }

  return { valid: known.valid && unknown.length === 0, errors: [...known.errors, ...unknown] };
}
