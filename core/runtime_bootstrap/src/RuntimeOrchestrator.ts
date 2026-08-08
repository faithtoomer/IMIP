import type { InstitutionalEventBus, EventDefinition } from '../../event_bus/src/index.js';
import { DependencyGraph } from './dependencyGraph.js';
import { RuntimeGovernanceBoard } from './governanceBoard.js';
import { certifyRuntime } from './certification.js';
import { assertRuntimeTransition } from './lifecycleStateMachine.js';
import { eventBusComponent, EVENT_BUS_COMPONENT_NAME } from './adapters.js';
import { BootstrapFailedError, CertificationFailedError, ComponentNotFoundError } from './errors.js';
import { RUNTIME_EVENTS } from './types.js';
import type {
  BootOptions,
  CertificationResult,
  ComponentDefinition,
  RuntimeEventName,
  RuntimeMetrics,
  RuntimeOperationRecord,
  RuntimeState,
} from './types.js';

const PUBLISHER_AUTHORITY = 'Runtime Bootstrap';

const RUNTIME_EVENT_DEFINITIONS: EventDefinition[] = Object.values(RUNTIME_EVENTS).map((name) => ({
  id: `runtime.${name}`,
  name,
  category: 'runtime',
  description: `IRBLM runtime event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: name === RUNTIME_EVENTS.RuntimeFaulted ? 'critical' : 'normal',
  deliveryMode: 'sync',
  targeting: 'broadcast',
  version: '1.0.0',
}));

const OPERATION_HISTORY_LIMIT = 200;

/**
 * IRBLM — the Institutional Runtime Bootstrap & Lifecycle Manager (PHASE-07).
 *
 * Unlike ICMS/IHIS (Phase 02/03), which mirror onto the IEB for backward
 * compatibility (ADR-0009 §6), IRBLM is new — it has no legacy synchronous API
 * to preserve, so it uses the IEB as its sole, direct event mechanism (Law 1,
 * fully realized) rather than a local emitter.
 *
 * Startup (§6) maps to code as: dependency-graph resolution (implicit
 * dependency verification) → per-component create+initialize → a distinct
 * readiness-verification pass → runtime certification → Operational.
 * Generic by design (§8/§10): nothing here hardcodes Capability Registry or
 * Plugin Registry by name — whichever ComponentDefinitions are registered
 * participate, in dependency order. See adapters.ts for the three concrete
 * components that exist today.
 */
export class RuntimeOrchestrator {
  readonly graph = new DependencyGraph();
  readonly board = new RuntimeGovernanceBoard();

  private readonly instances = new Map<string, unknown>();
  private readonly operationHistory: RuntimeOperationRecord[] = [];
  private state: RuntimeState = 'stopped';
  private lastCertification?: CertificationResult;
  private readonly metrics: RuntimeMetrics = { componentInitializationTimesMs: {}, recoveryCount: 0 };

  constructor(private readonly eventBus: InstitutionalEventBus) {
    for (const definition of RUNTIME_EVENT_DEFINITIONS) {
      if (!this.eventBus.getEventDefinition(definition.name)) {
        this.eventBus.registerEventType(definition);
      }
    }
    this.registerComponent(eventBusComponent(eventBus));
  }

  registerComponent<T>(definition: ComponentDefinition<T>): void {
    this.graph.register(definition);
    this.board.ensure(definition.name);
  }

  getRuntimeState(): RuntimeState {
    return this.state;
  }

  getCertificationStatus(): CertificationResult | undefined {
    return this.lastCertification;
  }

  getRuntimeHistory(): readonly RuntimeOperationRecord[] {
    return this.operationHistory;
  }

  getMetrics(): RuntimeMetrics {
    const uptimeMs =
      this.metrics.bootedAt && this.state === 'operational' ? Date.now() - Date.parse(this.metrics.bootedAt) : undefined;
    return { ...this.metrics, componentInitializationTimesMs: { ...this.metrics.componentInitializationTimesMs }, uptimeMs };
  }

  getInstance<T = unknown>(name: string): T {
    if (!this.instances.has(name)) throw new ComponentNotFoundError(name);
    return this.instances.get(name) as T;
  }

  async boot(options: BootOptions = {}): Promise<CertificationResult> {
    assertRuntimeTransition(this.state, 'booting');
    this.transition('booting');
    return this.runBootSequence(options);
  }

  async requestShutdown(): Promise<void> {
    assertRuntimeTransition(this.state, 'shutting-down');
    const startedAt = performance.now();
    const fromState = this.state;
    this.transition('shutting-down');
    await this.publishRuntimeEvent(RUNTIME_EVENTS.ShutdownRequested, { fromState });

    const order = this.graph.shutdownOrder();
    const failures: { component: string; message: string }[] = [];
    for (const name of order) {
      if (!this.instances.has(name)) continue;
      const definition = this.graph.get(name)!;
      try {
        await definition.shutdown(this.instances.get(name));
        this.board.markShutdown(name);
      } catch (error) {
        const message = (error as Error).message;
        failures.push({ component: name, message });
        this.board.markFailed(name, message, new Date().toISOString());
      }
    }

    this.metrics.lastShutdownDurationMs = performance.now() - startedAt;
    this.transition('stopped');
    await this.publishRuntimeEvent(RUNTIME_EVENTS.ShutdownCompleted, {
      durationMs: this.metrics.lastShutdownDurationMs,
      failures,
    });
    this.recordOperation('shutdown', startedAt, order, [], [], failures, 'not-applicable', 'stopped');
  }

  /** Full-platform restart (no name) or a single component's restart (name given).
   * Single-component restart does not cascade to its dependents — a documented
   * scope simplification (see docs/phase-07/implementation-summary.md). */
  async requestRestart(componentName?: string, options: BootOptions = {}): Promise<CertificationResult | void> {
    await this.publishRuntimeEvent(RUNTIME_EVENTS.RestartRequested, { componentName: componentName ?? 'platform' });

    if (componentName) {
      return this.restartComponent(componentName);
    }

    const startedAt = performance.now();
    this.transition('restarting');

    const order = this.graph.shutdownOrder();
    for (const name of order) {
      if (!this.instances.has(name)) continue;
      try {
        await this.graph.get(name)!.shutdown(this.instances.get(name));
      } catch {
        // Best-effort teardown during restart — failures here don't block the
        // rebuild; the rebuilt component's own readiness check is authoritative.
      }
      this.board.recordRestart(name);
    }
    this.instances.clear();

    this.transition('booting');
    const certification = await this.runBootSequence(options);
    this.metrics.lastRestartDurationMs = performance.now() - startedAt;
    return certification;
  }

  async requestMaintenance(): Promise<void> {
    this.transition('maintenance');
    this.recordOperation('maintenance', performance.now(), [], [], [], [], 'not-applicable', 'maintenance');
  }

  async pause(reason?: string): Promise<void> {
    this.transition('paused');
    await this.publishRuntimeEvent(RUNTIME_EVENTS.RuntimePaused, { reason });
  }

  async resume(): Promise<void> {
    this.transition('operational');
    await this.publishRuntimeEvent(RUNTIME_EVENTS.RuntimeResumed, {});
  }

  /** Re-validates currently-held instances without tearing them down or
   * recreating them — distinct from restart(), which rebuilds from scratch. */
  async recover(): Promise<CertificationResult> {
    assertRuntimeTransition(this.state, 'recovering');
    this.transition('recovering');

    const definitions = this.graph.all().filter((definition) => this.instances.has(definition.name));
    for (const definition of definitions) {
      const instance = this.instances.get(definition.name);
      this.board.updateReadiness(definition.name, definition.checkReadiness(instance));
      this.board.updateHealth(definition.name, definition.checkHealth(instance));
    }

    const certification = certifyRuntime(definitions, this.board);
    this.lastCertification = certification;

    if (certification.certified) {
      this.transition('operational');
      this.metrics.recoveryCount += 1;
      await this.publishRuntimeEvent(RUNTIME_EVENTS.RuntimeRecovered, { certification });
    } else {
      this.transition('faulted');
      await this.publishRuntimeEvent(RUNTIME_EVENTS.RuntimeFaulted, { reasons: certification.reasons });
    }

    return certification;
  }

  // ---- Internal ----

  private async restartComponent(name: string): Promise<void> {
    const definition = this.graph.get(name);
    if (!definition) throw new ComponentNotFoundError(name);

    const existing = this.instances.get(name);
    if (existing) {
      try {
        await definition.shutdown(existing);
      } catch {
        // best-effort
      }
    }

    const depMap = new Map<string, unknown>();
    for (const dep of definition.dependencies) depMap.set(dep, this.instances.get(dep));

    const instance = await definition.create(depMap);
    this.instances.set(name, instance);
    await definition.initialize(instance, depMap);

    const readiness = definition.checkReadiness(instance);
    this.board.updateReadiness(name, readiness);
    this.board.updateHealth(name, definition.checkHealth(instance));
    this.board.recordRestart(name);

    if (!readiness.ready) {
      this.board.markFailed(name, readiness.reasons.join('; '), new Date().toISOString());
      throw new BootstrapFailedError([{ component: name, message: readiness.reasons.join('; ') }]);
    }
    this.board.markInitialized(name, new Date().toISOString());
  }

  private async runBootSequence(options: BootOptions): Promise<CertificationResult> {
    const startedAt = performance.now();
    await this.publishRuntimeEvent(RUNTIME_EVENTS.BootstrapStarted, { timestamp: new Date().toISOString() });

    this.transition('initializing');
    await this.publishRuntimeEvent(RUNTIME_EVENTS.InitializationStarted, {});

    const order = this.graph.startupOrder(); // throws MissingDependencyError / CircularDependencyError
    const initStart = performance.now();
    const componentsInitialized: string[] = [];
    const initializedNames = new Set<string>();
    const initFailures: { component: string; message: string }[] = [];

    for (const name of order) {
      const definition = this.graph.get(name)!;
      // A dependency that was created but failed to *initialize* must still count
      // as missing — `this.instances` alone can't distinguish "created" from
      // "successfully initialized," so this checks the latter explicitly.
      const missingDeps = definition.dependencies.filter((dep) => !initializedNames.has(dep));
      this.board.updateDependencyStatus(name, missingDeps.length === 0, missingDeps);

      if (missingDeps.length > 0) {
        const message = `Blocked by failed dependency: ${missingDeps.join(', ')}.`;
        this.board.markFailed(name, message, new Date().toISOString());
        initFailures.push({ component: name, message });
        continue;
      }

      const depMap = new Map<string, unknown>();
      for (const dep of definition.dependencies) depMap.set(dep, this.instances.get(dep));
      const componentStart = performance.now();

      try {
        this.board.markCreated(name);
        const instance = await definition.create(depMap);
        this.instances.set(name, instance);

        this.board.markInitializing(name);
        await definition.initialize(instance, depMap);

        this.board.markInitialized(name, new Date().toISOString());
        componentsInitialized.push(name);
        initializedNames.add(name);
      } catch (error) {
        const message = (error as Error).message;
        this.board.markFailed(name, message, new Date().toISOString());
        initFailures.push({ component: name, message });
      }
      this.metrics.componentInitializationTimesMs[name] = performance.now() - componentStart;
    }

    this.metrics.initializationDurationMs = performance.now() - initStart;
    await this.publishRuntimeEvent(RUNTIME_EVENTS.InitializationCompleted, {
      initialized: componentsInitialized,
      failed: initFailures.map((f) => f.component),
    });

    if (initFailures.length > 0 && !options.allowPartialStartup) {
      this.transition('faulted');
      await this.publishRuntimeEvent(RUNTIME_EVENTS.RuntimeFaulted, { failures: initFailures });
      this.recordOperation('boot', startedAt, order, componentsInitialized, order.filter((n) => !componentsInitialized.includes(n)), initFailures, 'blocked', 'faulted');
      throw new BootstrapFailedError(initFailures);
    }

    this.transition('validating');
    const readinessStart = performance.now();
    const readinessFailures: { component: string; message: string }[] = [];

    for (const name of componentsInitialized) {
      const definition = this.graph.get(name)!;
      const instance = this.instances.get(name);
      const readiness = definition.checkReadiness(instance);
      this.board.updateReadiness(name, readiness);
      const health = definition.checkHealth(instance);
      this.board.updateHealth(name, health);
      if (!readiness.ready) {
        readinessFailures.push({ component: name, message: readiness.reasons.join('; ') || 'readiness check failed' });
      }
    }
    this.metrics.readinessDurationMs = performance.now() - readinessStart;
    await this.publishRuntimeEvent(RUNTIME_EVENTS.ReadinessVerified, { readinessFailures });

    if (readinessFailures.length > 0 && !options.allowPartialStartup) {
      this.transition('faulted');
      await this.publishRuntimeEvent(RUNTIME_EVENTS.RuntimeFaulted, { failures: readinessFailures });
      this.recordOperation('boot', startedAt, order, componentsInitialized, [], [...initFailures, ...readinessFailures], 'blocked', 'faulted');
      throw new BootstrapFailedError(readinessFailures);
    }

    const eligibleNames = componentsInitialized.filter((name) => this.board.get(name)!.readinessStatus.ready);
    const certification = certifyRuntime(eligibleNames.map((name) => this.graph.get(name)!), this.board);
    this.lastCertification = certification;

    if (!certification.certified) {
      this.transition('faulted');
      await this.publishRuntimeEvent(RUNTIME_EVENTS.RuntimeFaulted, { reasons: certification.reasons });
      this.recordOperation('boot', startedAt, order, componentsInitialized, [], initFailures, 'blocked', 'faulted');
      throw new CertificationFailedError(certification.reasons);
    }

    await this.publishRuntimeEvent(RUNTIME_EVENTS.RuntimeCertified, { certification });

    this.transition('ready');
    this.transition('operational');
    this.metrics.bootedAt = new Date().toISOString();
    this.metrics.startupDurationMs = performance.now() - startedAt;

    await this.publishRuntimeEvent(RUNTIME_EVENTS.RuntimeOperational, { startupDurationMs: this.metrics.startupDurationMs });
    await this.publishRuntimeEvent(RUNTIME_EVENTS.BootstrapCompleted, {
      componentsInitialized,
      durationMs: this.metrics.startupDurationMs,
    });

    this.recordOperation('boot', startedAt, order, componentsInitialized, [], initFailures, 'certified', 'operational');
    return certification;
  }

  private transition(to: RuntimeState): void {
    assertRuntimeTransition(this.state, to);
    this.state = to;
  }

  private async publishRuntimeEvent(name: RuntimeEventName, payload: unknown): Promise<void> {
    await this.eventBus.publish(name, PUBLISHER_AUTHORITY, payload);
  }

  private recordOperation(
    operation: string,
    startedAtPerfMs: number,
    dependenciesValidated: string[],
    componentsInitialized: string[],
    componentsSkipped: string[],
    failures: { component: string; message: string }[],
    certificationStatus: RuntimeOperationRecord['certificationStatus'],
    finalState: RuntimeState,
  ): void {
    this.operationHistory.push({
      operation,
      timestamp: new Date().toISOString(),
      durationMs: performance.now() - startedAtPerfMs,
      dependenciesValidated,
      componentsInitialized,
      componentsSkipped,
      failures,
      certificationStatus,
      finalState,
    });
    if (this.operationHistory.length > OPERATION_HISTORY_LIMIT) this.operationHistory.shift();
  }
}

export { EVENT_BUS_COMPONENT_NAME };
