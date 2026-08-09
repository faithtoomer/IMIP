export class AsicMiningFrameworkError extends Error { override name = 'AsicMiningFrameworkError'; }
export class AsicMiningValidationError extends AsicMiningFrameworkError { override name = 'AsicMiningValidationError'; }
export class AsicMiningLifecycleError extends AsicMiningFrameworkError { override name = 'AsicMiningLifecycleError'; constructor(from: string | undefined, to: string) { super(`Invalid ASIC mining lifecycle transition from ${from ?? 'none'} to ${to}.`); } }
export class AsicMiningSessionNotFoundError extends AsicMiningFrameworkError { override name = 'AsicMiningSessionNotFoundError'; }
export class AsicIsolationError extends AsicMiningFrameworkError { override name = 'AsicIsolationError'; }
