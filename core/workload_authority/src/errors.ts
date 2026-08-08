export class WorkloadError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'WorkloadError';
    this.code = code;
  }
}

export class WorkloadNotFoundError extends WorkloadError {
  readonly workloadId: string;

  constructor(workloadId: string) {
    super('WORKLOAD_NOT_FOUND', `Unknown workload: "${workloadId}".`);
    this.name = 'WorkloadNotFoundError';
    this.workloadId = workloadId;
  }
}

export class IllegalWorkloadStateTransitionError extends WorkloadError {
  constructor(from: string, to: string) {
    super('WORKLOAD_ILLEGAL_STATE_TRANSITION', `Illegal workload state transition: "${from}" -> "${to}".`);
    this.name = 'IllegalWorkloadStateTransitionError';
  }
}

export class WorkloadValidationError extends WorkloadError {
  constructor(message: string) {
    super('WORKLOAD_VALIDATION_FAILED', message);
    this.name = 'WorkloadValidationError';
  }
}

export class WorkloadDependencyError extends WorkloadError {
  constructor(workloadId: string, dependencyId: string, message?: string) {
    super(
      'WORKLOAD_DEPENDENCY_UNSATISFIED',
      message ?? `Workload "${workloadId}" has an unsatisfied dependency: "${dependencyId}".`,
    );
    this.name = 'WorkloadDependencyError';
  }
}

export class InvalidWorkloadPriorityError extends WorkloadError {
  constructor(priority: number) {
    super('WORKLOAD_INVALID_PRIORITY', `Workload priority must be an integer from 0 through 100; received ${priority}.`);
    this.name = 'InvalidWorkloadPriorityError';
  }
}
