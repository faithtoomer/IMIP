export class GpuMiningFrameworkError extends Error { override name = 'GpuMiningFrameworkError'; }
export class GpuMiningValidationError extends GpuMiningFrameworkError { override name = 'GpuMiningValidationError'; }
export class GpuMiningLifecycleError extends GpuMiningFrameworkError { override name = 'GpuMiningLifecycleError'; constructor(from: string | undefined, to: string) { super(`Invalid GPU mining lifecycle transition from ${from ?? 'none'} to ${to}.`); } }
export class GpuMiningSessionNotFoundError extends GpuMiningFrameworkError { override name = 'GpuMiningSessionNotFoundError'; }
export class GpuIsolationError extends GpuMiningFrameworkError { override name = 'GpuIsolationError'; }
