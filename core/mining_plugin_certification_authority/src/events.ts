import { EventEmitter } from 'node:events';
import type { PluginCertificationEventBusProvider } from './providers.js';
import type { CertificationLifecycleStage } from './types.js';
export const MINING_PLUGIN_CERTIFICATION_EVENTS = {
  PluginCertificationRequested: 'PluginCertificationRequested', PluginCertificationStarted: 'PluginCertificationStarted', PluginCertificationPassed: 'PluginCertificationPassed', PluginCertificationFailed: 'PluginCertificationFailed', PluginCertified: 'PluginCertified', PluginCertificationSuspended: 'PluginCertificationSuspended', PluginCertificationRevoked: 'PluginCertificationRevoked', PluginRecertificationRequired: 'PluginRecertificationRequired', PluginRecertified: 'PluginRecertified',
} as const;
export type MiningPluginCertificationEventName = (typeof MINING_PLUGIN_CERTIFICATION_EVENTS)[keyof typeof MINING_PLUGIN_CERTIFICATION_EVENTS];
export interface PluginCertificationEventPayload { certificationId: string; pluginUuid: string; version: string; stage: CertificationLifecycleStage; reason?: string; }
const PUBLISHER = 'Institutional Mining Plugin Certification Authority';
export class MiningPluginCertificationEventBus {
  private readonly emitter = new EventEmitter();
  constructor(private readonly institutional?: PluginCertificationEventBusProvider) {
    for (const name of Object.values(MINING_PLUGIN_CERTIFICATION_EVENTS)) if (!institutional?.getEventDefinition?.(name)) institutional?.registerEventType?.({ id: `mining-plugin-certification.${name}`, name, category: 'mining-plugin-certification', description: `IMPCA event: ${name}`, publisherAuthority: PUBLISHER, priority: name === MINING_PLUGIN_CERTIFICATION_EVENTS.PluginCertificationFailed || name === MINING_PLUGIN_CERTIFICATION_EVENTS.PluginCertificationRevoked ? 'high' : 'normal', deliveryMode: 'sync', targeting: 'broadcast', version: '1.0.0' });
  }
  publish(event: MiningPluginCertificationEventName, payload: PluginCertificationEventPayload): void { this.emitter.emit(event, payload); void Promise.resolve(this.institutional?.publish(event, PUBLISHER, payload)).catch(() => undefined); }
  subscribe(event: MiningPluginCertificationEventName, handler: (payload: PluginCertificationEventPayload) => void): () => void { this.emitter.on(event, handler); return () => this.emitter.off(event, handler); }
}
