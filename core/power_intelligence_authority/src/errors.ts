export class PowerIntelligenceAuthorityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class DeviceNotTrackedError extends PowerIntelligenceAuthorityError {
  constructor(deviceId: string) {
    super(`No power profile is tracked for device "${deviceId}".`);
  }
}

export class BudgetNotFoundError extends PowerIntelligenceAuthorityError {
  constructor(budgetId: string) {
    super(`No power budget "${budgetId}" is registered.`);
  }
}

export class InvalidPowerReadingError extends PowerIntelligenceAuthorityError {
  constructor(deviceId: string, watts: number) {
    super(`Invalid power reading for device "${deviceId}": ${watts}W is not a physically plausible value.`);
  }
}

export class NoPricingConfigurationError extends PowerIntelligenceAuthorityError {
  constructor(reason: string) {
    super(`Cannot compute energy cost: ${reason}`);
  }
}

export class InvalidPowerLifecycleTransitionError extends PowerIntelligenceAuthorityError {
  constructor(from: string, to: string) {
    super(`Cannot transition a power profile from "${from}" to "${to}".`);
  }
}
