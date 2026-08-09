export class MinerProcessError extends Error { constructor(message: string, public readonly code: string) { super(message); this.name = 'MinerProcessError'; } }
export class ProcessLifecycleError extends MinerProcessError { constructor(from: string | undefined, to: string) { super(`Invalid miner-process lifecycle transition from ${from ?? 'none'} to ${to}.`, 'INVALID_LIFECYCLE_TRANSITION'); } }
export class ProcessScopeError extends MinerProcessError { constructor(processUuid: string) { super(`Process scope violation for ${processUuid}.`, 'PROCESS_SCOPE_VIOLATION'); } }
export class DuplicateProcessError extends MinerProcessError { constructor(key: string) { super(`A miner process is already active for ${key}.`, 'DUPLICATE_PROCESS'); } }
