import type { MiningAdapter } from '../../mining_adapter_framework/src/adapterContract.js';
import type { AdapterManifest, NormalizedError, NormalizedStatistics } from '../../mining_adapter_framework/src/types.js';

export interface GpuPoolConfig { endpoint: string; protocol: string; passwordReference?: string; }
export interface GpuMemoryConfiguration { requiredVramMB: number; preferredVramMB?: number; memoryMode?: string; }
export interface GpuMiningConfig {
  gpuUuid: string;
  algorithm: string;
  pool: GpuPoolConfig;
  walletReference: string;
  workerIdentity: string;
  intensity: number;
  memoryConfiguration: GpuMemoryConfiguration;
  powerPolicyReference?: string;
  performancePolicyReference?: string;
  backendAdapter: MiningAdapter;
  backendManifest?: AdapterManifest;
}
export interface GpuThermalState { currentCelsius?: number; hotspotCelsius?: number; memoryCelsius?: number; fanRpm?: number; state: 'nominal' | 'elevated' | 'warning' | 'critical' | 'unknown'; warningThresholdCelsius?: number; criticalThresholdCelsius?: number; sensorAvailable: boolean; }
export interface GpuPowerState { currentWatts?: number; maximumRatedWatts?: number; powerLimitWatts?: number; budgetExceeded?: boolean; state: 'healthy' | 'degraded' | 'faulted' | 'unknown'; fanStatus?: 'available' | 'unavailable' | 'degraded' | 'unknown'; sensorAvailable: boolean; }
export interface GpuCertificationStatus { status: 'pending' | 'qualified' | 'certified' | 'production-approved' | 'recertified' | 'denied' | 'expired' | 'revoked' | 'unknown'; certificationId?: string; rationale?: string; }
/** Composed read snapshot: every field remains source-owned by an injected provider. */
export interface GpuProfile {
  gpuUuid: string; vendor: string; model: string; architecture: string;
  vramTotalMB: number; vramUsedMB: number; vramAvailableMB: number;
  driverVersion: string; computeCapability: string; pcie: { bus?: string; generation?: string; lanes?: number };
  allocatedComputeQueues: number; availableComputeQueues: number;
  thermalState: GpuThermalState; powerState: GpuPowerState; certificationStatus: GpuCertificationStatus;
  health: 'healthy' | 'degraded' | 'faulted' | 'unknown'; healthReasons: string[];
}
export interface GpuResourceRequest { gpuUuid: string; requiredVramMB: number; requestedComputeQueues: number; owner: string; requestingAuthority: string; priority?: number; leaseExpiration?: string; }
export interface GpuResourceGrant { reservationId: string; gpuUuid: string; grantedVramMB: number; grantedComputeQueues: number; expiresAt?: string; }
export interface GpuPerformanceRecord { sessionId: string; gpuUuid: string; recordedAt: string; hashrateHps?: number; acceptedShares?: number; rejectedShares?: number; invalidShares?: number; hashrateStability?: number; powerConsumptionWatts?: number; hashratePerWatt?: number; temperatureCelsius?: number; hotspotCelsius?: number; memoryTemperatureCelsius?: number; fanSpeedRpm?: number; uptimeSeconds?: number; sourceStatistics: NormalizedStatistics; }
/** The specification calls this 9-stage; its explicit nominal sequence contains nine stages. Failed is the exception state. */
export enum GpuMiningLifecycleStage { Requested = 'requested', GpuCompatibilityVerified = 'gpu-compatibility-verified', ResourceReserved = 'resource-reserved', Configured = 'configured', Prepared = 'prepared', Started = 'started', Running = 'running', Monitored = 'monitored', Stopped = 'stopped', Failed = 'failed' }
export interface GpuMiningLifecycleRecord { sessionId: string; from: GpuMiningLifecycleStage | undefined; to: GpuMiningLifecycleStage; at: string; reason: string; }
export type GpuFailureConditionType = 'driver-failure' | 'gpu-disappearance' | 'cuda-opencl-error' | 'vram-exhaustion' | 'thermal-throttling' | 'power-limit-violation' | 'miner-crash' | 'pool-failure';
export interface GpuFailureCondition { type: GpuFailureConditionType; severity: 'warning' | 'error' | 'critical'; detectedAt: string; rationale: string; normalizedError?: NormalizedError; evidence: Record<string, unknown>; }
export type GpuCapabilitySubject = 'vendor' | 'architecture' | 'driver' | 'vram' | 'compute-capability' | 'algorithm' | 'miner-support' | 'resource-availability' | 'certification-status';
export interface GpuCapabilityCheck { subject: GpuCapabilitySubject; passed: boolean; rationale: string; }
export interface GpuCapabilityNegotiationRequest { profile: GpuProfile; config: GpuMiningConfig; manifest: AdapterManifest; requiredVramMB: number; requestedComputeQueues?: number; supportedVendors?: string[]; supportedArchitectures?: string[]; minimumDriverVersion?: string; minimumComputeCapability?: string; }
export interface GpuCapabilityNegotiationResult { compatible: boolean; checks: GpuCapabilityCheck[]; reasons: string[]; }
export interface GpuOptimizationRecommendation { kind: 'power-efficiency' | 'workload-intensity' | 'gpu-selection' | 'memory-utilization' | 'algorithm-configuration'; advisory: true; rationale: string; suggestedValue: string | number; }
export interface GpuMiningDigitalTwinRecord { sessionId: string; recordedAt: string; gpuUuid: string; architecture: string; algorithm: string; configuration: { intensity: number; requiredVramMB: number }; hashrateHps?: number; powerWatts?: number; temperatureCelsius?: number; efficiencyHpsPerWatt?: number; reliability: 'healthy' | 'degraded' | 'faulted' | 'unknown'; }
export interface GpuMiningSession { sessionId: string; config: GpuMiningConfig; stage: GpuMiningLifecycleStage; grant?: GpuResourceGrant; compatibility?: GpuCapabilityNegotiationResult; }
export type { MiningAdapter } from '../../mining_adapter_framework/src/adapterContract.js';
export type { AdapterManifest, NormalizedError, NormalizedStatistics } from '../../mining_adapter_framework/src/types.js';
