import type { ValidationError } from './types.js';

/**
 * §18 — configuration failures fail fast with structured diagnostics.
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

/** Pipeline stage 1 (Syntax) failure — a source could not be parsed at all. */
export class ConfigurationSyntaxError extends ConfigurationError {
  readonly source: string;

  constructor(message: string, source: string) {
    super('CONFIGURATION_SYNTAX_ERROR', message);
    this.name = 'ConfigurationSyntaxError';
    this.source = source;
  }
}

export class ConfigurationRollbackError extends ConfigurationError {
  constructor(message: string) {
    super('CONFIGURATION_ROLLBACK_FAILED', message);
    this.name = 'ConfigurationRollbackError';
  }
}
