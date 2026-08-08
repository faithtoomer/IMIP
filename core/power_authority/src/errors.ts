export class PowerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PowerError';
    this.code = code;
  }
}

export class PowerNotFoundError extends PowerError {
  constructor(resource: string, id: string) {
    super('POWER_NOT_FOUND', `${resource} not found: "${id}"`);
    this.name = 'PowerNotFoundError';
  }
}

export class PowerInvalidTelemetryError extends PowerError {
  constructor(message: string) {
    super('POWER_INVALID_TELEMETRY', message);
    this.name = 'PowerInvalidTelemetryError';
  }
}

export class PowerBudgetError extends PowerError {
  constructor(message: string) {
    super('POWER_BUDGET_ERROR', message);
    this.name = 'PowerBudgetError';
  }
}

export class PowerCostError extends PowerError {
  constructor(message: string) {
    super('POWER_COST_ERROR', message);
    this.name = 'PowerCostError';
  }
}

export class PowerLifecycleError extends PowerError {
  constructor(message: string) {
    super('POWER_ILLEGAL_LIFECYCLE_TRANSITION', message);
    this.name = 'PowerLifecycleError';
  }
}
