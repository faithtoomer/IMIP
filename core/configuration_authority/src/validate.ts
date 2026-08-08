import type { ConfigEntry, ConfigValues, ValidationError, ValidationResult } from './types.js';

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'object';
  return typeof value;
}

/**
 * Type/range/enum/required/cross-field checks for a fixed set of entries.
 * Reused by the validation pipeline (stages 3-5) and by plugin-scoped
 * pre-validation (pluginConfig.ts). Unknown-key rejection (stage 2, schema)
 * is the pipeline's responsibility, not this function's.
 */
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

    if (entry.dataType !== 'enum' && actualType !== entry.dataType) {
      errors.push({
        id: entry.id,
        message: `"${entry.id}" expected type ${entry.dataType}, got ${actualType}.`,
      });
      continue;
    }

    if (entry.dataType === 'enum' && entry.enumValues && !entry.enumValues.includes(raw)) {
      errors.push({
        id: entry.id,
        message: `"${entry.id}" must be one of [${entry.enumValues.join(', ')}], got "${String(raw)}".`,
      });
      continue;
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
