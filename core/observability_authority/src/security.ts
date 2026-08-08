export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /private.?key/i,
  /api.?key/i,
  /wallet/i,
  /credential/i,
  /passphrase/i,
  /seed.?phrase/i,
];

/**
 * §14/Law 5 — always-on, pattern-based masking of freeform log context.
 * Unlike IDA's `redactSensitiveFields` (schema-declared, opt-in per field),
 * log context has no schema to declare sensitivity against, and Law 5's
 * wording is unconditional ("shall never appear in logs") — so masking runs
 * unconditionally on every context object a caller supplies, not only when
 * a caller opts in.
 */
export function maskSensitiveContext(
  context: Record<string, unknown> | undefined,
  extraSensitiveKeyPatterns: string[] = [],
): Record<string, unknown> | undefined {
  if (!context) return context;
  const patterns = [...SENSITIVE_KEY_PATTERNS, ...extraSensitiveKeyPatterns.map((pattern) => new RegExp(pattern, 'i'))];
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    masked[key] = patterns.some((pattern) => pattern.test(key)) ? REDACTED : value;
  }
  return masked;
}
