import type { MiningAdapter } from '../../mining_adapter_framework/src/adapterContract.js';
import type { AdapterManifest, NormalizedError, NormalizedStatistics } from '../../mining_adapter_framework/src/types.js';

/** Generic, coin-agnostic CPU algorithm declaration. No real algorithm is embedded in ICMF. */
export interface CpuAlgorithmProfile {
  algorithmId: string;
  requiredInstructionSets: string[];
  memoryRequirements: { minimumMB: number; recommendedMB?: number; perThreadMB?: number };
  threadCharacteristics: { minimumThreads: number; maximumThreads?: number; prefersPhysicalCores?: boolean; supportsSmt: boolean; numaAware: boolean };
}

export interface CpuThreadAllocationRequest {
  cpuUuid: string;
  requestedThreads: number;
  owner: string;
  requestingAuthority: string;
  priority?: number;
  leaseExpiration?: string;
  preferredNumaNodes?: number[];
}

export interface CpuThreadGrant {
  reservationId: string;
  cpuUuid: string;
  grantedThreadIds: number[];
  grantedCoreIds?: number[];
  numaNodeByThread?: Record<number, number>;
  expiresAt?: string;
}

export interface CpuAffinityPreference {
  strategy: 'compact' | 'spread' | 'physical-cores-first' | 'numa-local';
  preferredThreadIds?: number[];
  preferredNumaNodes?: number[];
  avoidSmt?: boolean;
}

export interface CpuPoolConfig { endpoint: string; protocol: string; passwordReference?: string; }
export type CpuPerformanceMode = 'eco' | 'balanced' | 'performance' | 'custom';
export interface CpuResourceLimits { maximumTemperatureCelsius?: number; maximumPowerWatts?: number; maximumUtilizationPercent?: number; minimumAvailableMemoryMB?: number; }

/** IMAF adapter reference is supplied by a composition root and must already be prepared/configured there. */
export interface CpuMiningConfig {
  algorithm: CpuAlgorithmProfile | string;
  threadAllocation: CpuThreadAllocationRequest;
  affinityPreference?: CpuAffinityPreference;
  backendAdapter: MiningAdapter;
  backendManifest?: AdapterManifest;
  pool: CpuPoolConfig;
  walletReference: string;
  workerIdentity: string;
  performanceMode: CpuPerformanceMode;
  resourceLimits?: CpuResourceLimits;
}

export interface CpuCacheInfo { l1KB?: number; l2KB?: number; l3KB?: number; }
export interface CpuNumaNode { nodeId: number; threadIds: number[]; memoryMB?: number; }
export interface CpuThermalState { currentCelsius?: number; state: 'nominal' | 'elevated' | 'warning' | 'critical' | 'unknown'; warningThresholdCelsius?: number; criticalThresholdCelsius?: number; sensorAvailable: boolean; }
export interface CpuPowerState { currentWatts?: number; state: 'healthy' | 'degraded' | 'faulted' | 'unknown'; maximumRatedWatts?: number; budgetLimitWatts?: number; budgetExceeded?: boolean; sensorAvailable: boolean; }
export interface CpuCertificationStatus { status: 'pending' | 'qualified' | 'certified' | 'production-approved' | 'recertified' | 'denied' | 'expired' | 'revoked' | 'unknown'; certificationId?: string; rationale?: string; }

/** Composed read view; every field is owned by an injected upstream provider. */
export interface CpuProfile {
  cpuUuid: string;
  coreCount: number;
  threadCount: number;
  architecture: string;
  instructionSets: string[];
  cache: CpuCacheInfo;
  numaTopology: CpuNumaNode[];
  availableThreads: number;
  allocatedThreads: number;
  currentUtilizationPercent?: number;
  availableMemoryMB?: number;
  thermalState: CpuThermalState;
  powerState: CpuPowerState;
  certificationStatus: CpuCertificationStatus;
  hardwareHealth: 'healthy' | 'degraded' | 'faulted' | 'unknown';
  hardwareHealthReasons: string[];
}

export interface CpuThreadPlacement { reservationId: string; threadIds: number[]; coreIds: number[]; numaNodes: number[]; smtUsed: boolean; strategy: CpuAffinityPreference['strategy']; }

export interface CpuPerformanceRecord {
  sessionId: string;
  recordedAt: string;
  hashrateHps?: number;
  hashratePerThread?: number;
  hashratePerWatt?: number;
  utilizationPercent?: number;
  acceptedShares?: number;
  rejectedShares?: number;
  errorRate?: number;
  uptimeSeconds?: number;
  thermalImpactCelsius?: number;
  powerConsumptionWatts?: number;
  sourceStatistics: NormalizedStatistics;
}

/** Nine nominal stages exactly match the enumerated phase lifecycle; Failed is an explicit exception state. */
export enum CpuMiningLifecycleStage {
  Requested = 'requested', Validated = 'validated', ResourcesReserved = 'resources-reserved', Configured = 'configured', Prepared = 'prepared', Started = 'started', Running = 'running', Monitored = 'monitored', Stopped = 'stopped', Failed = 'failed',
}
export interface CpuMiningLifecycleRecord { sessionId: string; from: CpuMiningLifecycleStage | undefined; to: CpuMiningLifecycleStage; at: string; reason: string; }

export type SafetyConditionType = 'excessive-cpu-temperature' | 'excessive-cpu-power' | 'resource-contention' | 'hardware-health-degradation' | 'miner-crash' | 'pool-failure' | 'invalid-configuration';
export interface SafetyCondition { type: SafetyConditionType; severity: 'warning' | 'error' | 'critical'; detectedAt: string; rationale: string; evidence: Record<string, unknown>; }

export interface AlgorithmCompatibilityCheck { subject: 'instruction-sets' | 'memory' | 'threads' | 'smt' | 'numa'; passed: boolean; rationale: string; }
export interface AlgorithmCompatibilityResult { algorithmId: string; compatible: boolean; checks: AlgorithmCompatibilityCheck[]; reasons: string[]; }

export interface OptimizationRecommendation { kind: 'thread-count' | 'affinity' | 'numa-placement' | 'performance-mode' | 'resource-utilization'; advisory: true; rationale: string; suggestedValue: string | number | string[]; }
export interface CpuDigitalTwinRecord { sessionId: string; recordedAt: string; cpuUuid: string; algorithmId: string; threadIds: number[]; affinity: CpuThreadPlacement; hashrateHps?: number; powerWatts?: number; temperatureCelsius?: number; efficiencyHpsPerWatt?: number; }

export interface CpuMiningSession { sessionId: string; config: CpuMiningConfig; stage: CpuMiningLifecycleStage; grant?: CpuThreadGrant; placement?: CpuThreadPlacement; compatibility?: AlgorithmCompatibilityResult; }
export interface AdapterMonitoringObservation { statistics: NormalizedStatistics; health: { status: 'healthy' | 'degraded' | 'faulted' | 'unknown'; reasons: string[]; observedAt?: string }; error?: NormalizedError; }

export type { MiningAdapter } from '../../mining_adapter_framework/src/adapterContract.js';
export type { AdapterManifest, NormalizedError, NormalizedStatistics } from '../../mining_adapter_framework/src/types.js';
