import { EventEmitter } from 'node:events';

/** §8 — minimum published workload event set. */
export const WORKLOAD_EVENTS = {
  WorkloadCreated: 'WorkloadCreated',
  WorkloadQueued: 'WorkloadQueued',
  WorkloadAssigned: 'WorkloadAssigned',
  WorkloadStarted: 'WorkloadStarted',
  WorkloadPaused: 'WorkloadPaused',
  WorkloadCompleted: 'WorkloadCompleted',
  WorkloadFailed: 'WorkloadFailed',
  WorkloadCancelled: 'WorkloadCancelled',
  WorkloadForecastUpdated: 'WorkloadForecastUpdated',
} as const;

export type WorkloadEventName = (typeof WORKLOAD_EVENTS)[keyof typeof WORKLOAD_EVENTS];

/** Interim authority-local event surface pending Institutional Event Bus wiring. */
export class WorkloadEventBus {
  private emitter = new EventEmitter();

  publish(event: WorkloadEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
  }

  subscribe(event: WorkloadEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }
}
