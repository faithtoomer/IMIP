import type { DomainSchema } from './types.js';

export const REDACTED = '[REDACTED]';

/**
 * §12/Law 5 — audit records must never leak sensitive values (Field-level
 * `sensitive: true` is IDA's only classification concept — it doesn't know
 * *why* a field is sensitive, only that the owning schema said so).
 */
export function redactSensitiveFields(schema: DomainSchema, data: Record<string, unknown> | undefined): unknown {
  if (!data) return data;
  const sensitiveFields = new Set(schema.fields.filter((f) => f.sensitive).map((f) => f.name));
  if (sensitiveFields.size === 0) return data;

  const redacted: Record<string, unknown> = { ...data };
  for (const field of sensitiveFields) {
    if (field in redacted) redacted[field] = REDACTED;
  }
  return redacted;
}
