import type { ExecutionOutcome, ScheduleExecutionHandler } from '../src/types.js';

/** A controllable clock for deterministic scheduler tests (Law 6). */
export class TestClock {
  constructor(private current: Date) {}

  now = (): Date => this.current;

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(date: Date): void {
    this.current = date;
  }
}

export function succeedingHandler(message = 'ok'): ScheduleExecutionHandler {
  return { execute: async (): Promise<ExecutionOutcome> => ({ success: true, message }) };
}

export function failingHandler(message = 'boom'): ScheduleExecutionHandler {
  return { execute: async (): Promise<ExecutionOutcome> => ({ success: false, message }) };
}

export function countingHandler(): ScheduleExecutionHandler & { count: number } {
  const handler = {
    count: 0,
    execute: async (): Promise<ExecutionOutcome> => {
      handler.count += 1;
      return { success: true };
    },
  };
  return handler;
}
