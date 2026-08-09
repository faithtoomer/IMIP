export type PluginRuntimeInterfaceName =
  | 'configuration'
  | 'eventBus'
  | 'resources'
  | 'hardwareIntelligence'
  | 'power'
  | 'thermal'
  | 'health'
  | 'statistics'
  | 'miningFrameworks'
  | 'security';

/** A declared dependency is checked only against this runtime's handed-in providers and working set; it is not a platform resolver. */
export interface PluginDependency {
  pluginUuid?: string;
  version?: string;
  interfaceName?: PluginRuntimeInterfaceName;
  required?: boolean;
}

export interface PluginManifest {
  pluginUuid: string;
  version: string;
  declaredDependencies: PluginDependency[];
  declaredCapabilities: string[];
  requiredInterfaces: PluginRuntimeInterfaceName[];
}

export interface PluginEntrypoint {
  initialize?(context: PluginRuntimeContext): void | Promise<void>;
  start?(context: PluginRuntimeContext): void | Promise<void>;
  pause?(context: PluginRuntimeContext): void | Promise<void>;
  resume?(context: PluginRuntimeContext): void | Promise<void>;
  stop?(context: PluginRuntimeContext): void | Promise<void>;
  unload?(context: PluginRuntimeContext): void | Promise<void>;
}

/** Package bytes/references remain opaque to IMPR; the caller hands in the selected instance. */
export interface PluginPackage { packageReference: unknown; entrypoint: PluginEntrypoint; }

export interface PluginInstanceIdentity {
  pluginInstanceUuid: string;
  pluginUuid: string;
  manifestVersion: string;
  loadedAt: string;
}

export enum PluginRuntimeLifecycleStage {
  Discovered = 'discovered',
  Validated = 'validated',
  Loaded = 'loaded',
  Initialized = 'initialized',
  Ready = 'ready',
  Active = 'active',
  Paused = 'paused',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Unloaded = 'unloaded',
  Failed = 'failed',
}

export interface PluginRuntimeContext {
  readonly configuration: import('./providers.js').ConfigurationAccessProvider;
  readonly eventBus: import('./providers.js').PluginEventBusProvider;
  readonly resources: import('./providers.js').ResourceAccessProvider;
  readonly hardwareIntelligence: import('./providers.js').HardwareIntelligenceAccessProvider;
  readonly power: import('./providers.js').PowerAccessProvider;
  readonly thermal: import('./providers.js').ThermalAccessProvider;
  readonly health: import('./providers.js').HealthAccessProvider;
  readonly statistics: import('./providers.js').StatisticsAccessProvider;
  readonly miningFrameworks: import('./providers.js').MiningFrameworkAccessProvider;
  readonly security: import('./providers.js').SecurityAccessProvider;
}

export interface PluginLoadRequest {
  manifest: PluginManifest;
  package: PluginPackage;
  pluginInstanceUuid?: string;
  executionTrace?: Partial<PluginExecutionTraceInput>;
}

export interface PluginValidationResult {
  valid: boolean;
  reasons: string[];
  manifestValid: boolean;
  dependenciesValid: boolean;
  certificationValid: boolean;
}

/** Phase 31's IMPCA will eventually produce this injected certification status. */
export interface CertificationStatus { certified: boolean; level: string; reason: string; }

export interface PluginLifecycleRecord {
  pluginInstanceUuid: string;
  from: PluginRuntimeLifecycleStage | undefined;
  to: PluginRuntimeLifecycleStage;
  at: string;
  reason: string;
}

export interface ManagedPluginRuntime {
  identity: Readonly<PluginInstanceIdentity>;
  manifest: Readonly<PluginManifest>;
  package: PluginPackage;
  context?: PluginRuntimeContext;
  stage: PluginRuntimeLifecycleStage;
  lifecycle: PluginLifecycleRecord[];
  validation?: PluginValidationResult;
  failureReason?: string;
}

export interface PluginExecutionTraceInput {
  dependencies: string[];
  capabilities: string[];
  resourceIds: string[];
  workloadUuids: string[];
  minerProcessUuids: string[];
  statisticIds: string[];
}

export interface PluginProcessStartRequest {
  pluginInstanceUuid: string;
  workloadUuid?: string;
  resourceIds?: string[];
  request: unknown;
}
