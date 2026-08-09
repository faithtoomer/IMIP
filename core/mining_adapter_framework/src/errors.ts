export class MiningAdapterFrameworkError extends Error { override name = 'MiningAdapterFrameworkError'; }
export class AdapterNotFoundError extends MiningAdapterFrameworkError {
  override name = 'AdapterNotFoundError';
  constructor(adapterId: string) { super(`Mining adapter ${adapterId} was not registered.`); }
}
export class AdapterLifecycleError extends MiningAdapterFrameworkError {
  override name = 'AdapterLifecycleError';
  constructor(from: string | undefined, to: string) { super(`Invalid adapter lifecycle transition from ${from ?? 'none'} to ${to}.`); }
}
export class AdapterRegistrationError extends MiningAdapterFrameworkError { override name = 'AdapterRegistrationError'; }
export class AdapterCertificationError extends MiningAdapterFrameworkError { override name = 'AdapterCertificationError'; }
