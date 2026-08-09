import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import type { MiningAdapter } from '../../mining_adapter_framework/src/adapterContract.js';
import type { NormalizedError, NormalizedStatistics } from '../../mining_adapter_framework/src/types.js';
import { CpuAlgorithmRegistry } from './algorithmAbstraction.js';
import { CpuProfileComposer } from './cpuProfile.js';
import { CpuPerformanceDigitalTwin } from './digitalTwin.js';
import { CpuMiningValidationError } from './errors.js';
import { CPU_MINING_EVENTS, CpuMiningEventBus, type CpuMiningEventName } from './events.js';
import { explainAlgorithmCompatibility, explainLifecycle, explainSafetyConditions } from './explainability.js';
import { assertCpuMiningLifecycleTransition } from './lifecycle.js';
import { recommendCpuOptimization } from './optimizationTelemetry.js';
import { CpuPerformanceHistory } from './performance.js';
import { CpuMiningSessionRegistry } from './registry.js';
import type { CpuMiningProviders } from './providers.js';
import { detectSafetyConditions } from './safety.js';
import { ThreadManagement } from './threadManagement.js';
import { CpuMiningLifecycleStage } from './types.js';
import type { AlgorithmCompatibilityResult, CpuAlgorithmProfile, CpuMiningConfig, CpuMiningLifecycleRecord, CpuMiningSession, CpuPerformanceRecord, CpuProfile, CpuThreadPlacement, OptimizationRecommendation, SafetyCondition } from './types.js';

export interface CpuMiningFrameworkOptions { providers: CpuMiningProviders; adapter: MiningAdapter; eventBus?: InstitutionalEventBus; now?: () => string; }

/**
 * ICMF composes a CPU mining *session* around an injected IMAF MiningAdapter
 * contract. It does not instantiate MiningAdapterFramework or recreate adapter
 * configuration, preparation, capability negotiation, normalization, or lifecycle.
 */
export class CpuMiningFramework {
  readonly algorithms = new CpuAlgorithmRegistry();
  readonly profiles: CpuProfileComposer;
  readonly threads = new ThreadManagement();
  readonly performance = new CpuPerformanceHistory();
  readonly digitalTwin = new CpuPerformanceDigitalTwin();
  readonly events: CpuMiningEventBus;
  readonly registry = new CpuMiningSessionRegistry();
  private readonly lifecycleRecords: CpuMiningLifecycleRecord[] = [];
  private readonly providers: CpuMiningProviders;
  private readonly adapter: MiningAdapter;
  private readonly nowFn: () => string;
  private sequence = 0;

  constructor(options: CpuMiningFrameworkOptions) { this.providers = options.providers; this.adapter = options.adapter; this.profiles = new CpuProfileComposer(options.providers); this.events = new CpuMiningEventBus(options.eventBus); this.nowFn = options.now ?? (() => new Date().toISOString()); }

  registerAlgorithm(profile: CpuAlgorithmProfile): void { this.algorithms.register(profile); }
  composeCpuProfile(cpuUuid: string): CpuProfile { return this.profiles.compose(cpuUuid); }

  /** Requests a reservation from IRIA, then plans only the granted threads and starts the already-prepared adapter contract. */
  async start(config: CpuMiningConfig): Promise<CpuMiningSession> {
    this.assertConfigShape(config);
    if (config.backendAdapter !== this.adapter) throw new CpuMiningValidationError('Session backend adapter must be the adapter injected into CpuMiningFramework.');
    const sessionId = `cpu-session-${++this.sequence}`;
    const session: CpuMiningSession = { sessionId, config, stage: CpuMiningLifecycleStage.Requested };
    this.registry.add(session); this.transition(session, CpuMiningLifecycleStage.Requested, 'CPU mining request accepted.'); this.events.publish(CPU_MINING_EVENTS.CpuMiningRequested, { sessionId, cpuUuid: config.threadAllocation.cpuUuid });
    try {
      const profile = this.profiles.compose(config.threadAllocation.cpuUuid);
      const algorithm = this.resolveAlgorithm(config.algorithm);
      const compatibility = this.algorithms.compatibility(profile, algorithm, config.threadAllocation.requestedThreads);
      session.compatibility = compatibility;
      if (!compatibility.compatible) throw new CpuMiningValidationError(`CPU algorithm compatibility failed: ${compatibility.reasons.join(' ')}`);
      const manifest = config.backendManifest ?? await this.adapter.identify();
      if (!manifest.supportedHardware.includes('cpu') || !manifest.supportedAlgorithms.includes(algorithm.algorithmId)) throw new CpuMiningValidationError('Injected adapter manifest does not support this CPU algorithm.');
      this.transition(session, CpuMiningLifecycleStage.Validated, 'Generic algorithm compatibility and supplied adapter manifest validation passed.');
      const grant = this.providers.resource.reserveThreads(config.threadAllocation);
      if (grant.grantedThreadIds.length === 0) throw new CpuMiningValidationError('IRIA provider returned no granted CPU threads.');
      session.grant = grant; this.transition(session, CpuMiningLifecycleStage.ResourcesReserved, 'IRIA-shaped provider granted CPU thread reservation.');
      this.transition(session, CpuMiningLifecycleStage.Configured, 'CPU session configuration references an adapter already configured through IMAF/composition root.');
      session.placement = this.threads.plan(profile, grant, config.affinityPreference);
      this.transition(session, CpuMiningLifecycleStage.Prepared, 'Granted CPU threads were prepared as an advisory affinity/NUMA placement plan.');
      this.events.publish(CPU_MINING_EVENTS.CpuMiningPrepared, { sessionId, placement: session.placement });
      await this.adapter.start();
      this.transition(session, CpuMiningLifecycleStage.Started, 'Injected IMAF MiningAdapter start contract completed.');
      this.transition(session, CpuMiningLifecycleStage.Running, 'CPU mining session is running on IRIA-granted threads.');
      this.events.publish(CPU_MINING_EVENTS.CpuMiningStarted, { sessionId });
      return this.snapshot(session);
    } catch (error) { await this.fail(session, error); throw error; }
  }

  /** Reads already-normalized IMAF adapter output and source-owned profile data; no local sensor/backend normalizer is implemented. */
  async monitor(sessionId: string, adapterError?: NormalizedError): Promise<{ record: CpuPerformanceRecord; safety: SafetyCondition[]; recommendations: OptimizationRecommendation[] }> {
    const session = this.requireSession(sessionId); if (!session.grant || !session.placement) throw new CpuMiningValidationError('Only a resource-reserved session can be monitored.');
    try {
      const profile = this.profiles.compose(session.config.threadAllocation.cpuUuid);
      const statistics = asNormalizedStatistics(await this.adapter.statistics());
      const health = await this.adapter.health();
      const record = this.performance.record(sessionId, statistics, { threadCount: session.placement.threadIds.length, utilizationPercent: profile.currentUtilizationPercent, thermalImpactCelsius: profile.thermalState.currentCelsius, powerConsumptionWatts: profile.powerState.currentWatts, recordedAt: this.nowFn() });
      this.digitalTwin.record({ sessionId, profile, algorithmId: this.resolveAlgorithm(session.config.algorithm).algorithmId, placement: session.placement, performance: record });
      if (session.stage === CpuMiningLifecycleStage.Running) this.transition(session, CpuMiningLifecycleStage.Monitored, 'Adapter statistics and health sampled through existing contract methods.');
      this.events.publish(CPU_MINING_EVENTS.CpuHashrateUpdated, { sessionId, record });
      this.events.publish(CPU_MINING_EVENTS.CpuMiningEfficiencyUpdated, { sessionId, hashratePerThread: record.hashratePerThread, hashratePerWatt: record.hashratePerWatt });
      const contentionReasons = this.providers.resource.getAllocation(profile.cpuUuid).contentionReasons;
      const safety = detectSafetyConditions({ profile, config: session.config, contentionReasons, adapterHealth: health, adapterError, at: this.nowFn() });
      if (safety.length) this.events.publish(CPU_MINING_EVENTS.CpuMiningDegraded, { sessionId, safety });
      return { record, safety, recommendations: recommendCpuOptimization(profile, session.placement, record) };
    } catch (error) { await this.fail(session, error); throw error; }
  }

  async stop(sessionId: string): Promise<CpuMiningSession> {
    const session = this.requireSession(sessionId);
    try { await this.adapter.stop(); this.transition(session, CpuMiningLifecycleStage.Stopped, 'Injected IMAF MiningAdapter stop contract completed.'); this.release(session, 'CPU mining session stopped.'); this.events.publish(CPU_MINING_EVENTS.CpuMiningStopped, { sessionId }); return this.snapshot(session); }
    catch (error) { await this.fail(session, error); throw error; }
  }

  getSession(sessionId: string): CpuMiningSession { return this.snapshot(this.requireSession(sessionId)); }
  getLifecycle(sessionId: string): CpuMiningLifecycleRecord[] { this.requireSession(sessionId); return this.lifecycleRecords.filter((record) => record.sessionId === sessionId); }
  getPerformance(sessionId: string): CpuPerformanceRecord[] { this.requireSession(sessionId); return this.performance.forSession(sessionId); }
  getRecommendations(sessionId: string): OptimizationRecommendation[] { const session = this.requireSession(sessionId); if (!session.placement) return []; return recommendCpuOptimization(this.profiles.compose(session.config.threadAllocation.cpuUuid), session.placement, this.performance.forSession(sessionId).at(-1)); }
  explainLifecycle(sessionId: string) { return explainLifecycle(this.getLifecycle(sessionId)); }
  explainCompatibility(sessionId: string) { const result = this.requireSession(sessionId).compatibility; if (!result) throw new CpuMiningValidationError('Session has no compatibility result yet.'); return explainAlgorithmCompatibility(result); }
  explainSafety(sessionId: string, safety: SafetyCondition[]) { this.requireSession(sessionId); return explainSafetyConditions(safety); }
  subscribe(event: CpuMiningEventName, handler: (payload: unknown) => void): () => void { return this.events.subscribe(event, handler); }

  private resolveAlgorithm(value: CpuMiningConfig['algorithm']): CpuAlgorithmProfile { if (typeof value === 'string') return this.algorithms.require(value); this.algorithms.register(value); return this.algorithms.require(value.algorithmId); }
  private requireSession(sessionId: string): CpuMiningSession { return this.registry.require(sessionId); }
  private transition(session: CpuMiningSession, to: CpuMiningLifecycleStage, reason: string): void { const from = this.lifecycleRecords.filter((record) => record.sessionId === session.sessionId).at(-1)?.to; assertCpuMiningLifecycleTransition(from, to); session.stage = to; this.lifecycleRecords.push(Object.freeze({ sessionId: session.sessionId, from, to, at: this.nowFn(), reason })); }
  private async fail(session: CpuMiningSession, error: unknown): Promise<void> { if (session.stage !== CpuMiningLifecycleStage.Failed && session.stage !== CpuMiningLifecycleStage.Stopped) this.transition(session, CpuMiningLifecycleStage.Failed, `CPU mining failure: ${error instanceof Error ? error.message : String(error)}`); this.release(session, 'CPU mining session failed.'); this.events.publish(CPU_MINING_EVENTS.CpuMiningFailed, { sessionId: session.sessionId, error: error instanceof Error ? error.message : String(error) }); }
  private release(session: CpuMiningSession, reason: string): void { if (session.grant) { this.providers.resource.releaseThreads(session.grant.reservationId, reason); session.grant = undefined; } }
  private snapshot(session: CpuMiningSession): CpuMiningSession { return { ...session, config: session.config, grant: session.grant ? { ...session.grant, grantedThreadIds: [...session.grant.grantedThreadIds], grantedCoreIds: session.grant.grantedCoreIds ? [...session.grant.grantedCoreIds] : undefined } : undefined, placement: session.placement ? { ...session.placement, threadIds: [...session.placement.threadIds], coreIds: [...session.placement.coreIds], numaNodes: [...session.placement.numaNodes] } : undefined, compatibility: session.compatibility ? { ...session.compatibility, checks: [...session.compatibility.checks], reasons: [...session.compatibility.reasons] } : undefined }; }
  private assertConfigShape(config: CpuMiningConfig): void { const unsafe = config as unknown as Record<string, unknown>; const pool = config.pool as unknown as Record<string, unknown>; const rawCredentialKeys = ['wallet', 'walletAddress', 'password', 'poolPassword', 'credentials']; if (rawCredentialKeys.some((key) => Object.hasOwn(unsafe, key) || Object.hasOwn(pool, key))) throw new CpuMiningValidationError('CPU mining config permits opaque references only; raw wallet or pool credentials are prohibited.'); if (!config.walletReference.trim() || !config.workerIdentity.trim() || !config.pool.endpoint.trim() || config.threadAllocation.requestedThreads <= 0) throw new CpuMiningValidationError('CPU mining config requires opaque wallet reference, worker identity, pool endpoint, and a positive thread request.'); }
}
function asNormalizedStatistics(raw: unknown): NormalizedStatistics { if (!raw || typeof raw !== 'object' || !('extensions' in raw)) throw new CpuMiningValidationError('ICMF requires IMAF-normalized adapter statistics with an extensions field.'); return raw as NormalizedStatistics; }
