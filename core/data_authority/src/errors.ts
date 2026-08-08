export class DataAuthorityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DataAuthorityError';
    this.code = code;
  }
}

export class UnknownDomainError extends DataAuthorityError {
  constructor(domain: string) {
    super('DATA_UNKNOWN_DOMAIN', `Domain "${domain}" has no registered schema.`);
    this.name = 'UnknownDomainError';
  }
}

export class DuplicateSchemaError extends DataAuthorityError {
  constructor(domain: string) {
    super('DATA_DUPLICATE_SCHEMA', `Domain "${domain}" already has a registered schema.`);
    this.name = 'DuplicateSchemaError';
  }
}

export class SchemaValidationError extends DataAuthorityError {
  readonly errors: string[];

  constructor(domain: string, errors: string[]) {
    super('DATA_SCHEMA_VALIDATION_FAILED', `Record for "${domain}" failed schema validation: ${errors.join('; ')}`);
    this.name = 'SchemaValidationError';
    this.errors = errors;
  }
}

export class DuplicateRecordError extends DataAuthorityError {
  constructor(domain: string, field: string, value: unknown) {
    super('DATA_DUPLICATE_RECORD', `"${domain}" already has a record with ${field} = ${JSON.stringify(value)}.`);
    this.name = 'DuplicateRecordError';
  }
}

export class RecordNotFoundError extends DataAuthorityError {
  constructor(domain: string, id: string) {
    super('DATA_RECORD_NOT_FOUND', `No record "${id}" in domain "${domain}".`);
    this.name = 'RecordNotFoundError';
  }
}

export class OptimisticConcurrencyError extends DataAuthorityError {
  constructor(domain: string, id: string, expectedRevision: number, actualRevision: number) {
    super(
      'DATA_CONCURRENCY_CONFLICT',
      `"${domain}"/"${id}" was updated concurrently: expected revision ${expectedRevision}, found ${actualRevision}.`,
    );
    this.name = 'OptimisticConcurrencyError';
  }
}

export class InvalidQueryFieldError extends DataAuthorityError {
  constructor(field: string) {
    super('DATA_INVALID_QUERY_FIELD', `"${field}" is not a valid query field name.`);
    this.name = 'InvalidQueryFieldError';
  }
}

export class BackupFailedError extends DataAuthorityError {
  constructor(message: string) {
    super('DATA_BACKUP_FAILED', message);
    this.name = 'BackupFailedError';
  }
}
