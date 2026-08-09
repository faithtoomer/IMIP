import type { MiningAdapter } from '../../mining_adapter_framework/src/adapterContract.js';
import type { AdapterManifest, NormalizedError, NormalizedStatistics } from '../../mining_adapter_framework/src/types.js';

/** Generic, opaque algorithm capability declaration. No production algorithm is embedded in IAMF. */
export interface AsicAlgorithmProfile { algorithmId: string; minimumFirmwareVersion?: string; requiredCapabilities?: string[]; requiresNetworkAccess?: boolean; }
export interface AsicPoolConfig { endpoint: string; protocol: string; credentialReference?: string; }
export interface AsicDeviceSelection { asicUuid: string; requiredHashboardIds: string[]; }
export interface AsicMiningConfig {
  asicUuid: string;
  algorithm: string;
  pool: AsicPoolConfig;
  walletReference: string;
  workerIdentity: string;
  deviceSelection: AsicDeviceSelection;
  performancePolicyReference?: string;
  powerPolicyReference?: string;
  thermalPolicyReference?: string;
  networkConfigurationReference?: string;
  /** Explicit adapter binding used to reject a configuration that points an adapter at another ASIC. */
  adapterDeviceUuid?: string;
  backendAdapter: MiningAdapter;
  backendManifest?: AdapterManifest;
}
export interface AsicThermalState { currentCelsius?: number; state: 'nominal' | 'elevated' | 'warning' | 'critical' | 'unknown'; warningThresholdCelsius?: number; criticalThresholdCelsius?: number; sensorAvailable: boolean; }
export interface AsicPowerState { currentWatts?: number; maximumRatedWatts?: number; budgetLimitWatts?: number; budgetExceeded?: boolean; state: 'healthy' | 'degraded' | 'faulted' | 'unknown'; sensorAvailable: boolean; }
export interface AsicHealthState { status: 'healthy' | 'degraded' | 'faulted' | 'unknown'; reasons: string[]; reliability?: number; observedAt?: string; }
export interface AsicCertificationStatus { status: 'pending' | 'qualified' | 'certified' | 'production-approved' | 'recertified' | 'denied' | 'expired' | 'revoked' | 'unknown'; certificationId?: string; rationale?: string; }
export interface AsicResourceState { deviceAvailable: boolean; allocated: boolean; availableHashboardIds: string[]; allocatedHashboardIds: string[]; contentionReasons: string[]; }
/** Composed read view: all identity, governance, telemetry, health, and certification fields remain provider-owned. */
export interface AsicProfile {
  asicUuid: string; manufacturer: string; model: string; firmware: string; hardwareRevision: string;
  algorithms: string[]; hashrateCapabilityHps?: number; powerProfile: { maximumRatedWatts?: number; nominalWatts?: number }; thermalProfile: { warningThresholdCelsius?: number; criticalThresholdCelsius?: number }; networkIdentity: { address?: string; hostname?: string; accessible: boolean };
  deviceHealth: AsicHealthState; resourceState: AsicResourceState; thermalState: AsicThermalState; powerState: AsicPowerState; certificationStatus: AsicCertificationStatus;
}
export interface AsicResourceRequest { asicUuid: string; requiredHashboardIds: string[]; owner: string; requestingAuthority: string; priority?: number; leaseExpiration?: string; }
export interface AsicResourceGrant { reservationId: string; asicUuid: string; grantedHashboardIds: string[]; expiresAt?: string; }
export interface AsicPerformanceRecord { sessionId: string; asicUuid: string; recordedAt: string; hashrateHps?: number; acceptedShares?: number; rejectedShares?: number; invalidShares?: number; hardwareErrors?: number; uptimeSeconds?: number; powerWatts?: number; temperatureCelsius?: number; efficiencyHpsPerWatt?: number; poolLatencyMs?: number; sourceStatistics: NormalizedStatistics; }
/** The specification has nine nominal stages exactly; Failed is the explicit exception state. */
export enum AsicMiningLifecycleStage { Requested = 'requested', Validated = 'validated', ResourceReserved = 'resource-reserved', Configured = 'configured', Prepared = 'prepared', Started = 'started', Running = 'running', Monitored = 'monitored', Stopped = 'stopped', Failed = 'failed' }
export interface AsicMiningLifecycleRecord { sessionId: string; from: AsicMiningLifecycleStage | undefined; to: AsicMiningLifecycleStage; at: string; reason: string; }
export type AsicFailureConditionType = 'device-disappearance' | 'communication-failure' | 'firmware-incompatibility' | 'hashboard-failure' | 'thermal-issues' | 'power-issues' | 'miner-failure' | 'pool-failure';
export interface AsicFailureCondition { type: AsicFailureConditionType; severity: 'warning' | 'error' | 'critical'; detectedAt: string; rationale: string; normalizedError?: NormalizedError; evidence: Record<string, unknown>; }
export type AsicCapabilitySubject = 'algorithm' | 'firmware' | 'adapter' | 'network' | 'power' | 'thermal' | 'resource' | 'certification';
export interface AsicCapabilityCheck { subject: AsicCapabilitySubject; passed: boolean; rationale: string; }
export interface AsicCapabilityNegotiationRequest { profile: AsicProfile; config: AsicMiningConfig; manifest: AdapterManifest; algorithmProfile: AsicAlgorithmProfile; }
export interface AsicCapabilityNegotiationResult { compatible: boolean; checks: AsicCapabilityCheck[]; reasons: string[]; }
export interface AsicOptimizationRecommendation { kind: 'power-efficiency' | 'device-selection' | 'algorithm-configuration'; advisory: true; rationale: string; suggestedValue: string | number; }
export interface AsicMiningDigitalTwinRecord { sessionId: string; recordedAt: string; asicUuid: string; manufacturer: string; model: string; algorithm: string; firmware: string; hashrateHps?: number; powerWatts?: number; thermalState: AsicThermalState['state']; health: AsicHealthState['status']; efficiencyHpsPerWatt?: number; reliability?: number; }
export interface AsicMiningSession { sessionId: string; config: AsicMiningConfig; stage: AsicMiningLifecycleStage; grant?: AsicResourceGrant; compatibility?: AsicCapabilityNegotiationResult; }
export type { MiningAdapter } from '../../mining_adapter_framework/src/adapterContract.js';
export type { AdapterManifest, NormalizedError, NormalizedStatistics } from '../../mining_adapter_framework/src/types.js';
