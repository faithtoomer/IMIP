export class HardwareError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'HardwareError';
    this.code = code;
  }
}

/** One category's discovery failed (§15). Callers catch this per-category and fall back
 * to the previous snapshot's data for that category rather than aborting discovery. */
export class HardwareDiscoveryError extends HardwareError {
  readonly category: string;

  constructor(category: string, message: string) {
    super('HARDWARE_DISCOVERY_FAILED', message);
    this.name = 'HardwareDiscoveryError';
    this.category = category;
  }
}

export class HardwareStateTransitionError extends HardwareError {
  constructor(message: string) {
    super('HARDWARE_ILLEGAL_STATE_TRANSITION', message);
    this.name = 'HardwareStateTransitionError';
  }
}

export class HardwareLifecycleError extends HardwareError {
  constructor(message: string) {
    super('HARDWARE_ILLEGAL_LIFECYCLE_TRANSITION', message);
    this.name = 'HardwareLifecycleError';
  }
}

export class HardwareNotFoundError extends HardwareError {
  constructor(deviceId: string) {
    super('HARDWARE_DEVICE_NOT_FOUND', `Unknown device: "${deviceId}"`);
    this.name = 'HardwareNotFoundError';
  }
}
