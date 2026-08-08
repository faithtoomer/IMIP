export class HealthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'HealthError';
    this.code = code;
  }
}

export class HealthProfileNotFoundError extends HealthError {
  constructor(identity: string) {
    super('HEALTH_PROFILE_NOT_FOUND', `Unknown health profile: ${identity}.`);
    this.name = 'HealthProfileNotFoundError';
  }
}

export class HealthValidationError extends HealthError {
  constructor(message: string) {
    super('HEALTH_VALIDATION_FAILED', message);
    this.name = 'HealthValidationError';
  }
}
