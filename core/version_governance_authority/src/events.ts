import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';
import { VERSION_EVENTS } from './types.js';
import type { VersionEventName } from './types.js';

const PUBLISHER_AUTHORITY = 'Version Governance & Migration Authority';

/** §15 — no existing EventCategory fits version governance specifically;
 * additive widening, the same precedent as ISMA's `'storage'` (ADR-0012)
 * and IBRRA's `'resilience'` (ADR-0017). See ADR-0018. */
const VERSION_EVENT_DEFINITIONS: EventDefinition[] = Object.values(VERSION_EVENTS).map((name) => ({
  id: `version-governance.${name}`,
  name,
  category: 'version-governance',
  description: `IVGMA event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: name === VERSION_EVENTS.MigrationFailed ? 'critical' : 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));

/**
 * Publish/subscribe surface for IVGMA, bridged onto the Institutional
 * Event Bus (ADR-0009 §6 mirror pattern) — the same choice made for ISTA/
 * INCA/IBRRA: IVGMA's own public API stays synchronous-callable so it can
 * be invoked inline from any other authority's own synchronous methods.
 */
export class VersionEventBus {
  private emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();

  constructor(private readonly iebBus?: InstitutionalEventBus) {
    if (this.iebBus) {
      for (const definition of VERSION_EVENT_DEFINITIONS) {
        if (!this.iebBus.getEventDefinition(definition.name)) {
          this.iebBus.registerEventType(definition);
        }
      }
    }
  }

  publish(event: VersionEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
    if (this.iebBus) {
      this.lastMirrorPromise = this.iebBus.publish(event, PUBLISHER_AUTHORITY, payload).catch(() => {
        // Mirroring is observability, not a functional dependency.
      });
    }
  }

  subscribe(event: VersionEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }

  async flushMirror(): Promise<void> {
    await this.lastMirrorPromise;
  }
}
