/**
 * IMAF-owned structural vocabulary. These types deliberately do not import
 * hardware, resource, security, plugin, or mining-authority implementations.
 */
export type AdapterHardwareKind = 'cpu' | 'gpu' | 'asic' | (string & {});

export type AdapterControlOperation = 'start' | 'pause' | 'resume' | 'stop' | 'restart';

export type NormalizedStatisticKey =
  | 'hashrateHps'
  | 'acceptedShares'
  | 'rejectedShares'
  | 'errorRate'
  | 'uptimeSeconds'
  | 'poolLatencyMs'
  | 'workerStatus'
  | 'temperatureCelsius'
  | 'powerWatts'
  | 'efficiencyHpsPerWatt';

export type AdapterCertificationStatus =
  | 'uncertified'
  | 'experimental'
  | 'development'
  | 'qualified'
  | 'production'
  | 'mission-critical'
  | 'revoked';

/** An adapter declaration supplied by an already-selected external integration. */
export interface AdapterManifest {
  adapterId: string;
  name: string;
  version: string;
  vendor: string;
  backend: string;
  supportedOperatingSystems: string[];
  supportedHardware: AdapterHardwareKind[];
  supportedAlgorithms: string[];
  supportedProtocols: string[];
  requiredCapabilities: string[];
  supportedFeatures: string[];
  configurationSchema: Record<string, unknown>;
  minimumFrameworkVersion: string;
  certificationStatus: AdapterCertificationStatus;
}

/**
 * Institutional configuration intentionally contains secret references only.
 * Wallet addresses, pool passwords, and credentials must be resolved by an
 * injected SecretProvider within a real adapter, never embedded here.
 */
export interface MiningInstitutionalConfig {
  adapterId: string;
  algorithm: string;
  operatingSystem: string;
  hardware: { kind: AdapterHardwareKind; identifiers?: string[]; capabilities?: string[] };
  pool: { endpoint: string; protocol: string; workerName?: string; walletSecretId?: string; passwordSecretId?: string };
  requiredStatistics?: NormalizedStatisticKey[];
  requiredControlOperations?: AdapterControlOperation[];
  options?: Record<string, unknown>;
}

/** Opaque backend representation produced only by an adapter-owned translator. */
export interface BackendConfig {
  adapterId: string;
  values: Record<string, unknown>;
  secretReferences: Record<string, string | undefined>;
}

export interface NormalizedStatistics {
  hashrateHps?: number;
  acceptedShares?: number;
  rejectedShares?: number;
  errorRate?: number;
  uptimeSeconds?: number;
  poolLatencyMs?: number;
  workerStatus?: string;
  temperatureCelsius?: number;
  powerWatts?: number;
  efficiencyHpsPerWatt?: number;
  extensions: Record<string, unknown>;
}

export enum NormalizedErrorCategory {
  ConfigurationFailure = 'ConfigurationFailure',
  DependencyFailure = 'DependencyFailure',
  HardwareIncompatible = 'HardwareIncompatible',
  DriverFailure = 'DriverFailure',
  NetworkFailure = 'NetworkFailure',
  PoolFailure = 'PoolFailure',
  AuthenticationFailure = 'AuthenticationFailure',
  ProcessFailure = 'ProcessFailure',
  RuntimeFailure = 'RuntimeFailure',
  UnknownFailure = 'UnknownFailure',
}

export interface NormalizedError {
  category: NormalizedErrorCategory;
  message: string;
  retriable: boolean;
  source?: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * The nominal path has ten stages. Failed and Rejected are explicit terminal
 * exception states reachable from multiple applicable stages, so no failure is
 * hidden as an untyped side channel.
 */
export enum AdapterLifecycleStage {
  Discovered = 'discovered',
  Registered = 'registered',
  Validated = 'validated',
  Configured = 'configured',
  Prepared = 'prepared',
  Started = 'started',
  Running = 'running',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Retired = 'retired',
  Failed = 'failed',
  Rejected = 'rejected',
}

export interface AdapterCapabilities {
  operatingSystems: string[];
  hardware: AdapterHardwareKind[];
  algorithms: string[];
  protocols: string[];
  statistics: NormalizedStatisticKey[];
  controlOperations: AdapterControlOperation[];
  features: string[];
}

export interface CapabilityNegotiationRequest {
  adapterId: string;
  operatingSystem: string;
  hardware: { kind: AdapterHardwareKind; capabilities?: string[] };
  algorithm: string;
  poolProtocol: string;
  requiredStatistics?: NormalizedStatisticKey[];
  requiredControlOperations?: AdapterControlOperation[];
  frameworkVersion?: string;
}

export interface CapabilityNegotiationCheck {
  subject: 'operating-system' | 'hardware' | 'algorithm' | 'pool-protocol' | 'statistics' | 'control-operation' | 'framework-version' | 'required-capability';
  requested: string;
  supported: boolean;
  reason: string;
}

export interface CapabilityNegotiationResult {
  adapterId: string;
  compatible: boolean;
  checks: CapabilityNegotiationCheck[];
  reasons: string[];
}

export interface AdapterValidationRequest {
  negotiation: CapabilityNegotiationRequest;
  config?: MiningInstitutionalConfig;
}

export interface AdapterValidationResult {
  valid: boolean;
  reasons: string[];
}

export interface AdapterPreparationContext {
  adapterId: string;
  componentId: string;
  secretProvider: import('./providers.js').SecretProvider;
}

export interface AdapterHealth {
  status: 'healthy' | 'degraded' | 'faulted' | 'unknown';
  reasons: string[];
  observedAt?: string;
}

export interface AdapterDiagnostics {
  summary?: string;
  details: Record<string, unknown>;
}

export interface AdapterLifecycleRecord {
  adapterId: string;
  from: AdapterLifecycleStage | undefined;
  to: AdapterLifecycleStage;
  at: string;
  reason: string;
}

export interface AdapterCertificationRecord {
  adapterId: string;
  status: AdapterCertificationStatus;
  rationale: string;
  updatedAt: string;
}
