import { EventEmitter } from 'node:events';

/** §12 — minimum published event set. */
export const HARDWARE_EVENTS = {
  Discovered: 'HardwareDiscovered',
  Removed: 'HardwareRemoved',
  Updated: 'HardwareUpdated',
  DeviceAvailable: 'DeviceAvailable',
  DeviceReserved: 'DeviceReserved',
  DeviceReleased: 'DeviceReleased',
  CapabilityChanged: 'CapabilityChanged',
  DriverChanged: 'DriverChanged',
  BenchmarkCompleted: 'BenchmarkCompleted',
  HardwareFaultDetected: 'HardwareFaultDetected',
} as const;

export type HardwareEventName = (typeof HARDWARE_EVENTS)[keyof typeof HARDWARE_EVENTS];

/**
 * Interim publish/subscribe surface for IHIS — same pattern as ICMS's
 * ConfigEventBus, standing in for the institutional Event Bus
 * (architecture/RUNTIME_ARCHITECTURE.md §6) until it is implemented.
 */
export class HardwareEventBus {
  private emitter = new EventEmitter();

  publish(event: HardwareEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
  }

  subscribe(event: HardwareEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }
}
