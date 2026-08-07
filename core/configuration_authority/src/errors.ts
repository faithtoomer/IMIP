import type { ValidationError } from './types.js';

/**
 * §15 — configuration failures fail fast with structured diagnostics.
 * Messages must never interpolate raw sensitive values (see security.ts) —
 * only ids and validation messages are carried here.
 */
export class ConfigurationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ConfigurationError';
    this.code = code;
  }
}

export class ConfigurationValidationError extends ConfigurationError {
  readonly errors: ValidationError[];

  constructor(message: string, errors: ValidationError[]) {
    super('CONFIGURATION_VALIDATION_FAILED', message);
    this.name = 'ConfigurationValidationError';
    this.errors = errors;
  }
}
