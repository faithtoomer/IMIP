import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';
import { STORAGE_EVENTS } from './types.js';
import type { StorageEventName } from './types.js';

const PUBLISHER_AUTHORITY = 'Storage Authority';

const STORAGE_EVENT_DEFINITIONS: EventDefinition[] = Object.values(STORAGE_EVENTS).map((name) => ({
  id: `storage.${name}`,
  name,
  category: 'storage',
  description: `ISMA event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: name === STORAGE_EVENTS.CapacityCritical ? 'critical' : name === STORAGE_EVENTS.CapacityWarning ? 'high' : 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));

/**
 * Publish/subscribe surface for ISMA, bridged onto the Institutional Event
 * Bus (ADR-0009 §6 mirror pattern) — the same shape as ICMS's ConfigEventBus
 * and IHIS's HardwareEventBus, not IRBLM's fully-async direct-publish
 * pattern. ISMA's own public API (`allocate`/`release`/etc.) must stay
 * synchronous so it can be called from IDA's and ICMS's synchronous
 * constructors (ADR-0012), so mirroring — not awaiting — is the only fit.
 */
export class StorageEventBus {
  private emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();

  constructor(private readonly iebBus?: InstitutionalEventBus) {
    if (this.iebBus) {
      for (const definition of STORAGE_EVENT_DEFINITIONS) {
        if (!this.iebBus.getEventDefinition(definition.name)) {
          this.iebBus.registerEventType(definition);
        }
      }
    }
  }

  publish(event: StorageEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
    if (this.iebBus) {
      this.lastMirrorPromise = this.iebBus.publish(event, PUBLISHER_AUTHORITY, payload).catch(() => {
        // Mirroring is observability, not a functional dependency — a mirror
        // failure must never affect ISMA's own local event delivery.
      });
    }
  }

  subscribe(event: StorageEventName, handler: (payload: unknown) => void): () => void {
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
