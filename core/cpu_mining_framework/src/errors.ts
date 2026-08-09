export class CpuMiningFrameworkError extends Error { override name = 'CpuMiningFrameworkError'; }
export class CpuMiningLifecycleError extends CpuMiningFrameworkError { override name = 'CpuMiningLifecycleError'; constructor(from: string | undefined, to: string) { super(`Invalid CPU mining lifecycle transition from ${from ?? 'none'} to ${to}.`); } }
export class CpuMiningValidationError extends CpuMiningFrameworkError { override name = 'CpuMiningValidationError'; }
export class CpuMiningSessionNotFoundError extends CpuMiningFrameworkError { override name = 'CpuMiningSessionNotFoundError'; }
