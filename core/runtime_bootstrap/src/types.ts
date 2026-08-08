/** §7 — runtime lifecycle states. */
export type RuntimeState =
  | 'stopped'
  | 'booting'
  | 'initializing'
  | 'validating'
  | 'ready'
  | 'operational'
  | 'paused'
  | 'maintenance'
  | 'restarting'
  | 'shutting-down'
  | 'recovering'
  | 'faulted';

export interface ReadinessCheckResult {
  ready: boolean;
  reasons: string[];
}

export type HealthStatus = 'healthy' | 'degraded' | 'faulted' | 'unknown';

export interface HealthCheckResult {
  status: HealthStatus;
  reasons: string[];
}

/**
 * §4/§9 — the contract every orchestrated authority implements. `create` and
 * `initialize` are separate stages (construction vs. the authority's own
 * startup work, e.g. ConfigurationAuthority.load()) so dependency instances
 * can be threaded into construction before initialization runs.
 */
export interface ComponentDefinition<TInstance = unknown> {
  name: string;
  dependencies: string[];
  create: (dependencies: ReadonlyMap<string, unknown>) => TInstance | Promise<TInstance>;
  initialize: (instance: TInstance, dependencies: ReadonlyMap<string, unknown>) => Promise<void>;
  checkReadiness: (instance: TInstance) => ReadinessCheckResult;
  checkHealth: (instance: TInstance) => HealthCheckResult;
  shutdown: (instance: TInstance) => Promise<void>;
}

/** §22 — Runtime Governance Board record, one per registered component. */
export interface GovernanceRecord {
  name: string;
  lifecycleState: 'unregistered' | 'created' | 'initializing' | 'initialized' | 'failed' | 'shutdown';
  readinessStatus: ReadinessCheckResult;
  healthStatus: HealthCheckResult;
  dependencyStatus: { satisfied: boolean; missing: string[] };
  certificationStatus: 'pending' | 'certified' | 'blocked';
  lastSuccessfulInitialization?: string;
  lastFailure?: { timestamp: string; message: string };
  restartCount: number;
  operationalEligible: boolean;
}

/** §10 — runtime certification result. */
export interface CertificationResult {
  certified: boolean;
  checkedAt: string;
  componentResults: { name: string; ready: boolean; health: HealthStatus; blocking: boolean }[];
  reasons: string[];
}

export interface BootOptions {
  /** Law 6 — partial startup is prohibited unless explicitly authorized. */
  allowPartialStartup?: boolean;
}

export interface RuntimeMetrics {
  startupDurationMs?: number;
  initializationDurationMs?: number;
  readinessDurationMs?: number;
  lastShutdownDurationMs?: number;
  lastRestartDurationMs?: number;
  componentInitializationTimesMs: Record<string, number>;
  bootedAt?: string;
  uptimeMs?: number;
  recoveryCount: number;
}

/** §13 — published runtime events. */
export const RUNTIME_EVENTS = {
  BootstrapStarted: 'BootstrapStarted',
  BootstrapCompleted: 'BootstrapCompleted',
  InitializationStarted: 'InitializationStarted',
  InitializationCompleted: 'InitializationCompleted',
  ReadinessVerified: 'ReadinessVerified',
  RuntimeCertified: 'RuntimeCertified',
  RuntimeOperational: 'RuntimeOperational',
  RuntimePaused: 'RuntimePaused',
  RuntimeResumed: 'RuntimeResumed',
  ShutdownRequested: 'ShutdownRequested',
  ShutdownCompleted: 'ShutdownCompleted',
  RestartRequested: 'RestartRequested',
  RuntimeRecovered: 'RuntimeRecovered',
  RuntimeFaulted: 'RuntimeFaulted',
} as const;

export type RuntimeEventName = (typeof RUNTIME_EVENTS)[keyof typeof RUNTIME_EVENTS];

/** §14 — a single explainable runtime operation record. */
export interface RuntimeOperationRecord {
  operation: string;
  timestamp: string;
  durationMs: number;
  dependenciesValidated: string[];
  componentsInitialized: string[];
  componentsSkipped: string[];
  failures: { component: string; message: string }[];
  certificationStatus: 'certified' | 'blocked' | 'not-applicable';
  finalState: RuntimeState;
}
