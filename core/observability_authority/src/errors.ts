export class ObservabilityAuthorityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ObservabilityAuthorityError';
    this.code = code;
  }
}

export class UnregisteredLogCategoryError extends ObservabilityAuthorityError {
  constructor(category: string) {
    super('IOLA_UNREGISTERED_CATEGORY', `"${category}" is not a registered log category.`);
    this.name = 'UnregisteredLogCategoryError';
  }
}

export class DuplicateLogCategoryError extends ObservabilityAuthorityError {
  constructor(category: string) {
    super('IOLA_DUPLICATE_CATEGORY', `Log category "${category}" is already registered.`);
    this.name = 'DuplicateLogCategoryError';
  }
}

export class UnregisteredLogSchemaError extends ObservabilityAuthorityError {
  constructor(category: string, operation: string) {
    super(
      'IOLA_UNREGISTERED_SCHEMA',
      `No log schema registered for category "${category}" / operation "${operation}". Free-form logging is prohibited (Law 2) — register a schema first.`,
    );
    this.name = 'UnregisteredLogSchemaError';
  }
}

export class DuplicateLogSchemaError extends ObservabilityAuthorityError {
  constructor(category: string, operation: string) {
    super('IOLA_DUPLICATE_SCHEMA', `A log schema for "${category}" / "${operation}" is already registered.`);
    this.name = 'DuplicateLogSchemaError';
  }
}

export class LogSchemaValidationError extends ObservabilityAuthorityError {
  constructor(category: string, operation: string, missingFields: string[]) {
    super(
      'IOLA_SCHEMA_VALIDATION_FAILED',
      `Log entry for "${category}" / "${operation}" is missing required context field(s): ${missingFields.join(', ')}.`,
    );
    this.name = 'LogSchemaValidationError';
  }
}

export class CorrelationNotFoundError extends ObservabilityAuthorityError {
  constructor(correlationId: string) {
    super('IOLA_CORRELATION_NOT_FOUND', `No log entries found for correlationId "${correlationId}".`);
    this.name = 'CorrelationNotFoundError';
  }
}

export class TraceNotFoundError extends ObservabilityAuthorityError {
  constructor(traceId: string) {
    super('IOLA_TRACE_NOT_FOUND', `No log entries found for traceId "${traceId}".`);
    this.name = 'TraceNotFoundError';
  }
}
