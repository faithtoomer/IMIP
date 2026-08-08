import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';
import { SECURITY_EVENTS } from './types.js';
import type { SecurityEventName } from './types.js';

const PUBLISHER_AUTHORITY = 'Security & Trust Authority';

const SECURITY_EVENT_DEFINITIONS: EventDefinition[] = Object.values(SECURITY_EVENTS).map((name) => ({
  id: `security.${name}`,
  name,
  category: 'security',
  description: `ISTA event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: name === SECURITY_EVENTS.SecurityViolation ? 'critical' : name === SECURITY_EVENTS.SecurityWarning ? 'high' : 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));

/**
 * Publish/subscribe surface for ISTA, bridged onto the Institutional Event
 * Bus (ADR-0009 §6 mirror pattern) — a deliberate choice, not ISOA's/
 * IRBLM's direct-publish pattern. ISTA is "one of the most important
 * authorities in the entire platform" (user framing) and every authority
 * with a synchronous public API (IDA, ICMS, ISMA) may eventually need to
 * call `authorize()`/`retrieveSecret()` inline from its own synchronous
 * methods — keeping ISTA's core decision surface synchronous, with events
 * mirrored fire-and-forget, maximizes that future compatibility. See
 * ADR-0015.
 */
export class SecurityEventBus {
  private emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();

  constructor(private readonly iebBus?: InstitutionalEventBus) {
    if (this.iebBus) {
      for (const definition of SECURITY_EVENT_DEFINITIONS) {
        if (!this.iebBus.getEventDefinition(definition.name)) {
          this.iebBus.registerEventType(definition);
        }
      }
    }
  }

  publish(event: SecurityEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
    if (this.iebBus) {
      this.lastMirrorPromise = this.iebBus.publish(event, PUBLISHER_AUTHORITY, payload).catch(() => {
        // Mirroring is observability, not a functional dependency.
      });
    }
  }

  subscribe(event: SecurityEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => {
      this.emitter.off(event, handler);
    };
  }

  async flushMirror(): Promise<void> {
    await this.lastMirrorPromise;
  }
}
