import type { PipelineProviderResult, PluginCertificationProviderInput } from './types.js';

export interface StaticValidationProvider { validate(input: PluginCertificationProviderInput): PipelineProviderResult | Promise<PipelineProviderResult>; }
export interface DependencyValidationProvider { validate(input: PluginCertificationProviderInput): PipelineProviderResult | Promise<PipelineProviderResult>; }
export interface SecurityValidationProvider { validate(input: PluginCertificationProviderInput): PipelineProviderResult | Promise<PipelineProviderResult>; }
export interface FunctionalTestProvider { test(input: PluginCertificationProviderInput): PipelineProviderResult | Promise<PipelineProviderResult>; }
export interface CompatibilityTestProvider { test(input: PluginCertificationProviderInput): PipelineProviderResult | Promise<PipelineProviderResult>; }
export interface PerformanceTestProvider { test(input: PluginCertificationProviderInput): PipelineProviderResult | Promise<PipelineProviderResult>; }
export interface RuntimeTestProvider { test(input: PluginCertificationProviderInput): PipelineProviderResult | Promise<PipelineProviderResult>; }

export interface PluginCertificationPipelineProviders {
  staticValidation: StaticValidationProvider;
  dependencyValidation: DependencyValidationProvider;
  securityValidation: SecurityValidationProvider;
  functionalTesting: FunctionalTestProvider;
  compatibilityTesting: CompatibilityTestProvider;
  performanceTesting: PerformanceTestProvider;
  runtimeTesting: RuntimeTestProvider;
}

/** Future ICR handoff only. IMPCA remains fully functional without this optional port. */
export interface CapabilityRegistrationNotifier {
  notifyCertification(input: { pluginUuid: string; version: string; certificationId: string; status: { certified: boolean; level: string; reason: string } }): void | Promise<void>;
}

export interface PluginCertificationClock { now(): string; }
export interface PluginCertificationEventBusProvider {
  publish(eventName: string, publisher: string, payload: unknown, options?: unknown): unknown;
  subscribeToEvent?(eventName: string, handler: (event: unknown) => void | Promise<void>, options: { subscriberAuthority: string }): () => void;
  getEventDefinition?(eventName: string): unknown;
  registerEventType?(definition: { id: string; name: string; category: 'mining-plugin-certification'; description: string; publisherAuthority: string; priority: 'normal' | 'high'; deliveryMode: 'sync'; targeting: 'broadcast'; version: string }): void;
}

export interface MiningPluginCertificationAuthorityDependencies {
  providers: PluginCertificationPipelineProviders;
  clock: PluginCertificationClock;
  createUuid?: () => string;
  eventBus?: PluginCertificationEventBusProvider;
  capabilityRegistrationNotifier?: CapabilityRegistrationNotifier;
}
