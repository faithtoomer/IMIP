import { EventEmitter } from 'node:events';

/** §15 — minimum published event set. */
export const RESOURCE_EVENTS = {
  ResourceRegistered: 'ResourceRegistered',
  ResourceAvailable: 'ResourceAvailable',
  ResourceReserved: 'ResourceReserved',
  ResourceReservationExpired: 'ResourceReservationExpired',
  ResourceAllocated: 'ResourceAllocated',
  ResourceReleased: 'ResourceReleased',
  ResourceUnavailable: 'ResourceUnavailable',
  ResourceOwnershipChanged: 'ResourceOwnershipChanged',
  ResourceForecastUpdated: 'ResourceForecastUpdated',
  ResourceUtilizationUpdated: 'ResourceUtilizationUpdated',
} as const;

export type ResourceEventName = (typeof RESOURCE_EVENTS)[keyof typeof RESOURCE_EVENTS];

/**
 * Interim publish/subscribe surface for IRIA — same pattern as IHIS's
 * HardwareEventBus, standing in for the institutional Event Bus until
 * it is implemented.
 */
export class ResourceEventBus {
  private emitter = new EventEmitter();

  publish(event: ResourceEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
  }

  subscribe(event: ResourceEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }
}
