import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';

/** §12 — minimum published event set. */
export const HARDWARE_EVENTS = {
  Discovered: 'HardwareDiscovered',
  Removed: 'HardwareRemoved',
  Updated: 'HardwareUpdated',
  DeviceRegistered: 'DeviceRegistered',
  DeviceAvailable: 'DeviceAvailable',
  DeviceReserved: 'DeviceReserved',
  DeviceReleased: 'DeviceReleased',
  CapabilityChanged: 'CapabilityChanged',
  DriverChanged: 'DriverChanged',
  BenchmarkCompleted: 'BenchmarkCompleted',
  HardwareFaultDetected: 'HardwareFaultDetected',
} as const;

export type HardwareEventName = (typeof HARDWARE_EVENTS)[keyof typeof HARDWARE_EVENTS];

const PUBLISHER_AUTHORITY = 'Hardware Authority';

/** Event catalog mirrored onto the IEB (ADR-0009). HardwareFaultDetected is
 * elevated to 'high' priority so a priority-aware future subscriber sees it
 * ahead of routine inventory events in the queue; everything else is 'normal'. */
const HARDWARE_EVENT_DEFINITIONS: EventDefinition[] = Object.values(HARDWARE_EVENTS).map((name) => ({
  id: `hardware.${name}`,
  name,
  category: 'hardware',
  description: `IHIS event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: name === HARDWARE_EVENTS.HardwareFaultDetected ? 'high' : 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));

/**
 * Publish/subscribe surface for IHIS, bridged onto the Institutional Event Bus
 * (PHASE-05, ADR-0009) — same pattern as ICMS's ConfigEventBus.
 *
 * Local delivery (this class's own `emitter`) remains the primary mechanism,
 * unchanged: `publish()`/`subscribe()` keep their exact synchronous behavior
 * and signatures, so HardwareAuthority's public API is unaffected. When an
 * `InstitutionalEventBus` is supplied, every publish is additionally mirrored
 * onto it (fire-and-forget) after registering IHIS's event catalog there.
 */
export class HardwareEventBus {
  private emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();

  constructor(private readonly iebBus?: InstitutionalEventBus) {
    if (this.iebBus) {
      for (const definition of HARDWARE_EVENT_DEFINITIONS) {
        if (!this.iebBus.getEventDefinition(definition.name)) {
          this.iebBus.registerEventType(definition);
        }
      }
    }
  }

  publish(event: HardwareEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
    if (this.iebBus) {
      this.lastMirrorPromise = this.iebBus.publish(event, PUBLISHER_AUTHORITY, payload).catch(() => {
        // Mirroring is observability, not a functional dependency — a mirror
        // failure must never affect IHIS's own local event delivery.
      });
    }
  }

  subscribe(event: HardwareEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }

  /** Test/diagnostic hook: resolves once the most recent mirror publish has settled. */
  async flushMirror(): Promise<void> {
    await this.lastMirrorPromise;
  }
}
