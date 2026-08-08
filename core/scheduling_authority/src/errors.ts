import type { ScheduleStatus } from './types.js';

export class SchedulingAuthorityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SchedulingAuthorityError';
    this.code = code;
  }
}

export class InvalidScheduleError extends SchedulingAuthorityError {
  constructor(reason: string) {
    super('SCHEDULE_INVALID', `Invalid schedule: ${reason}`);
    this.name = 'InvalidScheduleError';
  }
}

export class DuplicateScheduleError extends SchedulingAuthorityError {
  constructor(scheduleId: string) {
    super('SCHEDULE_DUPLICATE', `Schedule "${scheduleId}" is already registered.`);
    this.name = 'DuplicateScheduleError';
  }
}

export class ScheduleNotFoundError extends SchedulingAuthorityError {
  constructor(scheduleId: string) {
    super('SCHEDULE_NOT_FOUND', `No schedule "${scheduleId}" is registered.`);
    this.name = 'ScheduleNotFoundError';
  }
}

export class CircularScheduleDependencyError extends SchedulingAuthorityError {
  constructor(cyclePath: string[]) {
    super('SCHEDULE_CIRCULAR_DEPENDENCY', `Circular schedule dependency detected: ${cyclePath.join(' -> ')}.`);
    this.name = 'CircularScheduleDependencyError';
  }
}

export class InvalidScheduleTransitionError extends SchedulingAuthorityError {
  constructor(from: ScheduleStatus, to: ScheduleStatus) {
    super('SCHEDULE_INVALID_TRANSITION', `Cannot transition a schedule from "${from}" to "${to}".`);
    this.name = 'InvalidScheduleTransitionError';
  }
}

export class ExecutionTimeoutError extends SchedulingAuthorityError {
  constructor(timeoutMs: number) {
    super('SCHEDULE_EXECUTION_TIMEOUT', `Execution exceeded its ${timeoutMs}ms timeout.`);
    this.name = 'ExecutionTimeoutError';
  }
}
