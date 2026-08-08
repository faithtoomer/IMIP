export class ArbitrationError extends Error { override name = 'ArbitrationError'; }
export class ArbitrationValidationError extends ArbitrationError { override name = 'ArbitrationValidationError'; }
export class ArbitrationNotFoundError extends ArbitrationError { override name = 'ArbitrationNotFoundError'; }
export class ArbitrationLifecycleError extends ArbitrationError {
  override name = 'ArbitrationLifecycleError';
  constructor(from: string | undefined, to: string) { super(`Invalid arbitration lifecycle transition from ${from ?? 'none'} to ${to}.`); }
}
