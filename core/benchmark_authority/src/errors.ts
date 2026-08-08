export class BenchmarkError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BenchmarkError';
    this.code = code;
  }
}

export class BenchmarkNotFoundError extends BenchmarkError {
  constructor(identity: string) {
    super('BENCHMARK_NOT_FOUND', `Unknown benchmark record: ${identity}.`);
    this.name = 'BenchmarkNotFoundError';
  }
}

export class BenchmarkValidationError extends BenchmarkError {
  constructor(message: string) {
    super('BENCHMARK_VALIDATION_FAILED', message);
    this.name = 'BenchmarkValidationError';
  }
}

export class BenchmarkLifecycleError extends BenchmarkError {
  constructor(from: string | undefined, to: string) {
    super('BENCHMARK_INVALID_LIFECYCLE_TRANSITION', `Cannot transition benchmark lifecycle from ${from ?? 'none'} to ${to}.`);
    this.name = 'BenchmarkLifecycleError';
  }
}
