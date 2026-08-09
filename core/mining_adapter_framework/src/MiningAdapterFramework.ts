import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import type { MiningAdapter } from './adapterContract.js';
import { AdapterCertificationRegistry } from './certification.js';
import { ConfigTranslatorRegistry, type ConfigTranslator } from './configTranslation.js';
import { ErrorClassifierRegistry, type ErrorClassifier } from './errorNormalization.js';
import { AdapterNotFoundError, AdapterRegistrationError } from './errors.js';
import { ADAPTER_EVENTS, AdapterEventBus, type AdapterEventName } from './events.js';
import { explainCapabilityNegotiation, explainErrorNormalization, type CapabilityNegotiationExplanation, type ErrorNormalizationExplanation } from './explainability.js';
import { assertAdapterLifecycleTransition } from './lifecycle.js';
import { CapabilityNegotiationEngine } from './negotiation.js';
import type { SecretProvider } from './providers.js';
import { MiningBackendRegistry, type AdapterRegistryRecord } from './registry.js';
import { assertNoRawCredentials, redactSecrets } from './security.js';
import { StatisticsNormalizerRegistry, type StatisticsNormalizer } from './statsNormalization.js';
import {
  AdapterLifecycleStage,
  type AdapterCertificationRecord,
  type AdapterCertificationStatus,
  type AdapterDiagnostics,
  type AdapterLifecycleRecord,
  type AdapterValidationResult,
  type CapabilityNegotiationRequest,
  type CapabilityNegotiationResult,
  type MiningInstitutionalConfig,
  type NormalizedError,
  type NormalizedStatistics,
} from './types.js';

export interface AdapterRegistrationOptions {
  configTranslator?: ConfigTranslator;
  statisticsNormalizer?: StatisticsNormalizer;
  errorClassifier?: ErrorClassifier;
}

export interface MiningAdapterFrameworkOptions {
  eventBus?: InstitutionalEventBus;
  secretProvider: SecretProvider;
  componentId?: string;
  frameworkVersion?: string;
  now?: () => string;
}

/**
 * IMAF orchestrates supplied adapter contracts. It performs no plugin scanning,
 * hardware discovery, allocation, scheduling, secret storage, or coin logic.
 */
export class MiningAdapterFramework {
  readonly registry = new MiningBackendRegistry();
  readonly negotiation = new CapabilityNegotiationEngine();
  readonly translations = new ConfigTranslatorRegistry();
  readonly statistics = new StatisticsNormalizerRegistry();
  readonly errors = new ErrorClassifierRegistry();
  readonly certification: AdapterCertificationRegistry;
  readonly events: AdapterEventBus;

  private readonly lifecycleRecords: AdapterLifecycleRecord[] = [];
  private readonly stages = new Map<string, AdapterLifecycleStage>();
  private readonly secretReferences = new Map<string, Set<string>>();
  private readonly nowFn: () => string;
  private readonly frameworkVersion: string;
  private readonly secretProvider: SecretProvider;
  private readonly componentId: string;

  constructor(options: MiningAdapterFrameworkOptions) {
    this.nowFn = options.now ?? (() => new Date().toISOString());
    this.frameworkVersion = options.frameworkVersion ?? '1.0.0';
    this.secretProvider = options.secretProvider;
    this.componentId = options.componentId ?? 'mining-adapter-framework';
    this.certification = new AdapterCertificationRegistry(this.nowFn);
    this.events = new AdapterEventBus(options.eventBus);
  }

  /**
   * Registers an adapter object explicitly supplied by a composition root or future
   * Mining Authority. This is not filesystem/plugin discovery or manifest validation.
   */
  async registerAdapter(adapter: MiningAdapter, options: AdapterRegistrationOptions = {}): Promise<AdapterRegistryRecord> {
    const manifest = await adapter.identify();
    if (this.registry.get(manifest.adapterId) || this.stages.has(manifest.adapterId)) throw new AdapterRegistrationError(`Adapter ${manifest.adapterId} is already registered.`);
    this.transition(manifest.adapterId, AdapterLifecycleStage.Discovered, 'Adapter contract supplied explicitly by a composition root.');
    this.events.publish(ADAPTER_EVENTS.AdapterDiscovered, { adapterId: manifest.adapterId, manifest });
    const capabilities = await adapter.capabilities();
    this.registry.register({ manifest, capabilities, adapter });
    this.certification.initialize(manifest.adapterId, manifest.certificationStatus);
    if (options.configTranslator) this.translations.register(manifest.adapterId, options.configTranslator);
    if (options.statisticsNormalizer) this.statistics.register(manifest.adapterId, options.statisticsNormalizer);
    if (options.errorClassifier) this.errors.register(manifest.adapterId, options.errorClassifier);
    this.transition(manifest.adapterId, AdapterLifecycleStage.Registered, 'Adapter manifest and declared capabilities recorded in the IMAF registry.');
    const record = this.registry.require(manifest.adapterId);
    this.events.publish(ADAPTER_EVENTS.AdapterRegistered, { adapterId: manifest.adapterId, manifest: record.manifest, capabilities: record.capabilities });
    return record;
  }

  async validateAdapter(adapterId: string, request: CapabilityNegotiationRequest, config?: MiningInstitutionalConfig): Promise<CapabilityNegotiationResult> {
    const record = this.registry.require(adapterId);
    if (config) assertNoRawCredentials(config);
    const result = this.negotiate(adapterId, request);
    if (!result.compatible) {
      this.transition(adapterId, AdapterLifecycleStage.Rejected, `Capability negotiation rejected adapter: ${result.reasons.join(' ')}`);
      this.events.publish(ADAPTER_EVENTS.AdapterRejected, { adapterId, result });
      return result;
    }
    try {
      const validation = await record.adapter.validate({ negotiation: request, config });
      if (!validation.valid) {
        const rejected: CapabilityNegotiationResult = { ...result, compatible: false, reasons: [...validation.reasons].sort((a, b) => a.localeCompare(b)) };
        this.transition(adapterId, AdapterLifecycleStage.Rejected, `Adapter validation rejected execution: ${rejected.reasons.join(' ')}`);
        this.events.publish(ADAPTER_EVENTS.AdapterRejected, { adapterId, result: rejected });
        return rejected;
      }
      this.transition(adapterId, AdapterLifecycleStage.Validated, 'Capability negotiation and adapter validation passed.');
      this.events.publish(ADAPTER_EVENTS.AdapterValidated, { adapterId, result });
      return result;
    } catch (error) {
      await this.fail(adapterId, error);
      throw error;
    }
  }

  negotiate(adapterId: string, request: CapabilityNegotiationRequest): CapabilityNegotiationResult {
    if (request.adapterId !== adapterId) throw new AdapterNotFoundError(`request adapter ${request.adapterId} does not match ${adapterId}`);
    return this.negotiation.negotiate(this.registry.require(adapterId), request, this.frameworkVersion);
  }

  async configureAdapter(adapterId: string, config: MiningInstitutionalConfig): Promise<void> {
    if (config.adapterId !== adapterId) throw new AdapterNotFoundError(`configuration adapter ${config.adapterId} does not match ${adapterId}`);
    assertNoRawCredentials(config);
    this.secretReferences.set(adapterId, new Set([config.pool.walletSecretId, config.pool.passwordSecretId].filter((reference): reference is string => Boolean(reference))));
    try {
      const backendConfig = this.translations.translate(config);
      await this.registry.require(adapterId).adapter.configure(backendConfig);
      this.transition(adapterId, AdapterLifecycleStage.Configured, 'Institutional configuration translated by the adapter-owned translator.');
      this.events.publish(ADAPTER_EVENTS.AdapterConfigured, { adapterId });
    } catch (error) { await this.fail(adapterId, error); throw error; }
  }

  async prepareAdapter(adapterId: string): Promise<void> {
    try {
      await this.registry.require(adapterId).adapter.prepare({ adapterId, componentId: this.componentId, secretProvider: this.secretProvider });
      this.transition(adapterId, AdapterLifecycleStage.Prepared, 'Adapter prepared through the injected SecretProvider context.');
      this.events.publish(ADAPTER_EVENTS.MinerPrepared, { adapterId });
    } catch (error) { await this.fail(adapterId, error); throw error; }
  }

  async startAdapter(adapterId: string): Promise<void> {
    try {
      await this.registry.require(adapterId).adapter.start();
      this.transition(adapterId, AdapterLifecycleStage.Started, 'Adapter start contract completed.');
      this.transition(adapterId, AdapterLifecycleStage.Running, 'Adapter entered running state.');
      this.events.publish(ADAPTER_EVENTS.MinerStarted, { adapterId });
    } catch (error) { await this.fail(adapterId, error); throw error; }
  }

  async pauseAdapter(adapterId: string): Promise<void> { await this.registry.require(adapterId).adapter.pause(); }
  async resumeAdapter(adapterId: string): Promise<void> { await this.registry.require(adapterId).adapter.resume(); }

  async stopAdapter(adapterId: string): Promise<void> {
    try {
      this.transition(adapterId, AdapterLifecycleStage.Stopping, 'Adapter stop requested through the lifecycle contract.');
      await this.registry.require(adapterId).adapter.stop();
      this.transition(adapterId, AdapterLifecycleStage.Stopped, 'Adapter stop contract completed.');
      this.events.publish(ADAPTER_EVENTS.MinerStopped, { adapterId });
    } catch (error) { await this.fail(adapterId, error); throw error; }
  }

  async restartAdapter(adapterId: string): Promise<void> {
    try {
      const stage = this.stage(adapterId);
      if (stage === AdapterLifecycleStage.Running || stage === AdapterLifecycleStage.Started) this.transition(adapterId, AdapterLifecycleStage.Stopping, 'Adapter restart requested.');
      if (this.stage(adapterId) === AdapterLifecycleStage.Stopping) this.transition(adapterId, AdapterLifecycleStage.Stopped, 'Adapter restart completed its prior run shutdown.');
      await this.registry.require(adapterId).adapter.restart();
      this.transition(adapterId, AdapterLifecycleStage.Started, 'Adapter restart contract completed.');
      this.transition(adapterId, AdapterLifecycleStage.Running, 'Adapter resumed running after restart.');
      this.events.publish(ADAPTER_EVENTS.MinerRecovered, { adapterId, recovery: 'restart' });
    } catch (error) { await this.fail(adapterId, error); throw error; }
  }

  async recoverAdapter(adapterId: string): Promise<void> {
    if (this.stage(adapterId) !== AdapterLifecycleStage.Failed) throw new Error('Only a failed adapter can be recovered.');
    await this.restartAdapter(adapterId);
  }

  async cleanupAdapter(adapterId: string): Promise<void> {
    try {
      await this.registry.require(adapterId).adapter.cleanup();
      this.transition(adapterId, AdapterLifecycleStage.Retired, 'Adapter cleanup completed; the registered adapter is retired.');
    } catch (error) { await this.fail(adapterId, error); throw error; }
  }

  async health(adapterId: string) { return this.registry.require(adapterId).adapter.health(); }
  async collectStatistics(adapterId: string): Promise<NormalizedStatistics> {
    try {
      const normalized = this.statistics.normalize(adapterId, await this.registry.require(adapterId).adapter.statistics());
      this.events.publish(ADAPTER_EVENTS.MinerStatisticsUpdated, { adapterId, statistics: normalized });
      return normalized;
    } catch (error) { await this.fail(adapterId, error); throw error; }
  }
  async diagnostics(adapterId: string): Promise<AdapterDiagnostics> {
    const diagnostics = await this.registry.require(adapterId).adapter.diagnostics();
    const knownSecrets = [...(this.secretReferences.get(adapterId) ?? [])].flatMap((reference) => {
      try { return [this.secretProvider.retrieveSecret(reference, this.componentId)]; } catch { return []; }
    });
    return redactSecrets(diagnostics, knownSecrets);
  }

  normalizeError(adapterId: string, error: unknown): NormalizedError { this.registry.require(adapterId); return this.errors.normalize(adapterId, error); }
  explainNegotiation(adapterId: string, request: CapabilityNegotiationRequest): CapabilityNegotiationExplanation { return explainCapabilityNegotiation(this.negotiate(adapterId, request)); }
  explainError(adapterId: string, error: unknown): ErrorNormalizationExplanation { return explainErrorNormalization(this.normalizeError(adapterId, error)); }
  getLifecycle(adapterId: string): AdapterLifecycleRecord[] { return this.lifecycleRecords.filter((entry) => entry.adapterId === adapterId); }
  stage(adapterId: string): AdapterLifecycleStage { const stage = this.stages.get(adapterId); if (!stage) throw new AdapterNotFoundError(adapterId); return stage; }
  certificationStatus(adapterId: string): AdapterCertificationRecord { return this.certification.require(adapterId); }
  certifyAdapter(adapterId: string, status: AdapterCertificationStatus, rationale: string): AdapterCertificationRecord { return this.certification.transition(adapterId, status, rationale); }
  subscribe(event: AdapterEventName, handler: (payload: unknown) => void): () => void { return this.events.subscribe(event, handler); }

  private async fail(adapterId: string, error: unknown): Promise<NormalizedError> {
    const normalized = this.normalizeError(adapterId, error);
    const current = this.stages.get(adapterId);
    if (current && current !== AdapterLifecycleStage.Failed && current !== AdapterLifecycleStage.Rejected && current !== AdapterLifecycleStage.Retired) {
      this.transition(adapterId, AdapterLifecycleStage.Failed, `Adapter failure normalized as ${normalized.category}: ${normalized.message}`);
    }
    this.events.publish(ADAPTER_EVENTS.MinerFailed, { adapterId, error: redactSecrets(normalized) });
    return normalized;
  }

  private transition(adapterId: string, to: AdapterLifecycleStage, reason: string): void {
    const from = this.stages.get(adapterId);
    assertAdapterLifecycleTransition(from, to);
    this.stages.set(adapterId, to);
    this.lifecycleRecords.push(Object.freeze({ adapterId, from, to, at: this.nowFn(), reason }));
  }
}
