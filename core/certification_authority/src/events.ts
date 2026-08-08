import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';

export const CERTIFICATION_EVENTS = {
  CertificationStarted: 'CertificationStarted',
  CertificationPassed: 'CertificationPassed',
  CertificationFailed: 'CertificationFailed',
  CertificationRevoked: 'CertificationRevoked',
  RecertificationRequired: 'RecertificationRequired',
  CertificationExpired: 'CertificationExpired',
} as const;

export type CertificationEventName = (typeof CERTIFICATION_EVENTS)[keyof typeof CERTIFICATION_EVENTS];

const PUBLISHER_AUTHORITY = 'Hardware Certification Authority';

export const CERTIFICATION_EVENT_DEFINITIONS: EventDefinition[] = Object.values(CERTIFICATION_EVENTS).map((name) => ({
  id: `certification.${name}`,
  name,
  category: 'certification',
  description: `IHCA event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: name === CERTIFICATION_EVENTS.CertificationRevoked || name === CERTIFICATION_EVENTS.CertificationFailed ? 'high' : 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));

/** Local publication is synchronous; institutional event-bus mirroring is best effort. */
export class CertificationEventBus {
  private readonly emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();

  constructor(private readonly institutionalEventBus?: InstitutionalEventBus) {
    if (institutionalEventBus) {
      for (const definition of CERTIFICATION_EVENT_DEFINITIONS) {
        if (!institutionalEventBus.getEventDefinition(definition.name)) {
          institutionalEventBus.registerEventType(definition);
        }
      }
    }
  }

  publish(event: CertificationEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
    if (this.institutionalEventBus) {
      this.lastMirrorPromise = this.institutionalEventBus
        .publish(event, PUBLISHER_AUTHORITY, payload)
        .catch(() => undefined);
    }
  }

  subscribe(event: CertificationEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }

  async flushMirror(): Promise<void> {
    await this.lastMirrorPromise;
  }
}
