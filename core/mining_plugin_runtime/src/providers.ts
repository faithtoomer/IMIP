import type { CertificationStatus, PluginManifest } from './types.js';

export interface ConfigurationAccessProvider { has(key: string): boolean; get(key: string): unknown; }
/** Deliberately structural: a composition root can adapt the institutional Event Bus without a singleton. */
export interface PluginEventBusProvider {
  publish(eventName: string, publisher: string, payload: unknown, options?: unknown): unknown;
  subscribeToEvent?(eventName: string, handler: (event: unknown) => void | Promise<void>, options: { subscriberAuthority: string }): () => void;
  getEventDefinition?(eventName: string): unknown;
  registerEventType?(definition: { id: string; name: string; category: 'mining-plugin-runtime'; description: string; publisherAuthority: string; priority: 'normal' | 'high'; deliveryMode: 'sync'; targeting: 'broadcast'; version: string }): void;
}
export interface ResourceAccessProvider { getResource(resourceId: string): unknown; assessAvailability?(resourceId: string): unknown; }
/** Read/intelligence only: no raw control surface is exposed to plugins. */
export interface HardwareIntelligenceAccessProvider { getHardwareIntelligence(hardwareId: string): unknown; }
export interface PowerAccessProvider { getPowerAssessment(subjectId: string): unknown; }
export interface ThermalAccessProvider { getThermalAssessment(subjectId: string): unknown; }
export interface HealthAccessProvider { getHealthAssessment(subjectId: string): unknown; }
export interface StatisticsAccessProvider { queryStatistics(query: Record<string, unknown>): unknown; }
export interface MiningFrameworkAccessProvider { getFrameworkCapabilities(framework: string): unknown; }
export interface SecurityAccessProvider { authorize(input: { pluginInstanceUuid: string; operation: string; context?: Record<string, unknown> }): unknown; }
/** Minimal IMPM-shaped hand-off. IMPR delegates and never creates an operating-system process. */
export interface ProcessManagerHandle { launch(request: unknown): Promise<unknown>; }
/** Placeholder seam for Phase 31 IMPCA; a missing or non-certified record is a hard load refusal. */
export interface PluginCertificationStatusProvider { getCertificationStatus(input: { pluginUuid: string; version: string; manifest: PluginManifest }): CertificationStatus | undefined | Promise<CertificationStatus | undefined>; }
export interface PluginRuntimeClock { now(): string; }
export interface MiningPluginRuntimeDependencies {
  configuration: ConfigurationAccessProvider;
  eventBus: PluginEventBusProvider;
  resources: ResourceAccessProvider;
  hardwareIntelligence: HardwareIntelligenceAccessProvider;
  power: PowerAccessProvider;
  thermal: ThermalAccessProvider;
  health: HealthAccessProvider;
  statistics: StatisticsAccessProvider;
  miningFrameworks: MiningFrameworkAccessProvider;
  security: SecurityAccessProvider;
  processManager: ProcessManagerHandle;
  certificationStatus: PluginCertificationStatusProvider;
  clock: PluginRuntimeClock;
  createUuid?: () => string;
}
