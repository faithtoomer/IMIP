export class ThermalError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ThermalError';
    this.code = code;
  }
}

export class ThermalNotFoundError extends ThermalError {
  constructor(deviceId: string) {
    super('THERMAL_DEVICE_NOT_FOUND', `Unknown thermal device: "${deviceId}"`);
    this.name = 'ThermalNotFoundError';
  }
}

export class ThermalLifecycleError extends ThermalError {
  constructor(message: string) {
    super('THERMAL_ILLEGAL_LIFECYCLE_TRANSITION', message);
    this.name = 'ThermalLifecycleError';
  }
}

export class ThermalSensorError extends ThermalError {
  readonly deviceId: string;

  constructor(deviceId: string, message: string) {
    super('THERMAL_SENSOR_ERROR', message);
    this.name = 'ThermalSensorError';
    this.deviceId = deviceId;
  }
}

export class ThermalDiagnosticError extends ThermalError {
  readonly deviceId: string;

  constructor(deviceId: string, message: string) {
    super('THERMAL_DIAGNOSTIC_ERROR', message);
    this.name = 'ThermalDiagnosticError';
    this.deviceId = deviceId;
  }
}

export class ThermalBudgetError extends ThermalError {
  constructor(message: string) {
    super('THERMAL_BUDGET_ERROR', message);
    this.name = 'ThermalBudgetError';
  }
}

export class ThermalForecastError extends ThermalError {
  readonly deviceId: string;

  constructor(deviceId: string, message: string) {
    super('THERMAL_FORECAST_ERROR', message);
    this.name = 'ThermalForecastError';
    this.deviceId = deviceId;
  }
}
