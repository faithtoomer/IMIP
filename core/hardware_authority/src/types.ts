export type HardwareCategory = 'cpu' | 'gpu' | 'asic' | 'memory' | 'storage' | 'motherboard' | 'network';

export type HardwareCapability =
  | 'cpu-mining'
  | 'gpu-mining'
  | 'asic-mining'
  | 'ai-inference'
  | 'ai-training'
  | 'virtualization'
  | 'benchmarking'
  | 'thermal-monitoring'
  | 'power-monitoring'
  | 'fan-control'
  | 'hardware-telemetry';

/** §9 — runtime state, tracked independently from inventory. */
export type RuntimeState =
  | 'available'
  | 'reserved'
  | 'busy'
  | 'benchmarking'
  | 'mining'
  | 'ai-workload'
  | 'offline'
  | 'faulted'
  | 'maintenance';

/** §10 — device lifecycle stage. */
export type LifecycleStage =
  | 'discovered'
  | 'registered'
  | 'capability-assessed'
  | 'benchmarked'
  | 'available'
  | 'allocated'
  | 'released'
  | 'retired';

export type HealthStatus = 'healthy' | 'degraded' | 'faulted' | 'unknown';

export interface HealthSummary {
  status: HealthStatus;
  reasons: string[];
  lastCheckedAt: string;
}

export interface DeviceIdentity {
  vendor?: string;
  model?: string;
  architecture?: string;
  serial?: string;
  firmware?: string;
  driver?: string;
}

export interface CpuInfo {
  manufacturer?: string;
  model?: string;
  architecture?: string;
  physicalCores?: number;
  logicalCores?: number;
  cacheHierarchyKB?: { l1?: number; l2?: number; l3?: number };
  instructionSets?: string[];
  virtualizationSupport?: boolean;
  currentUtilizationPercent?: number;
  frequencyMHz?: { current?: number; min?: number; max?: number };
  thermalSensors?: { label: string; celsius: number }[];
}

export interface GpuInfo {
  vendor?: string;
  model?: string;
  architecture?: string;
  vramMB?: number;
  cudaSupport?: boolean;
  openClSupport?: boolean;
  driverVersion?: string;
  pcie?: { generation?: number; laneWidth?: number };
  powerLimitWatts?: number;
  fanSupport?: boolean;
  temperatureCelsius?: number;
}

export interface AsicInfo {
  vendor?: string;
  model?: string;
  firmware?: string;
  hashBoards?: number;
  coolingType?: string;
  fanStatus?: string;
  poolConnectivity?: 'connected' | 'disconnected' | 'unknown';
}

export interface MemoryInfo {
  installedCapacityMB?: number;
  availableMB?: number;
  eccSupported?: boolean;
  channels?: number;
  speedMHz?: number;
  utilizationPercent?: number;
}

export interface StorageInfo {
  deviceType?: 'ssd' | 'hdd' | 'nvme' | 'unknown';
  capacityMB?: number;
  availableMB?: number;
  health?: 'healthy' | 'warning' | 'critical' | 'unknown';
  smartStatus?: 'ok' | 'failing' | 'unknown';
  performance?: { readMBs?: number; writeMBs?: number };
}

export interface MotherboardInfo {
  manufacturer?: string;
  model?: string;
  biosVersion?: string;
  chipset?: string;
  expansionSlots?: number;
}

export interface NetworkInfo {
  interfaceName?: string;
  speedMbps?: number;
  linkStatus?: 'up' | 'down' | 'unknown';
  latencyMs?: number;
  connectivityState?: 'connected' | 'disconnected' | 'unknown';
}

export type CategoryInfo = CpuInfo | GpuInfo | AsicInfo | MemoryInfo | StorageInfo | MotherboardInfo | NetworkInfo;

export interface BenchmarkResult {
  deviceId: string;
  workload: string;
  metric: string;
  value: number;
  unit: string;
  recordedAt: string;
}

export interface BenchmarkSummary {
  latestByWorkload: Record<string, BenchmarkResult>;
  bestByWorkload: Record<string, BenchmarkResult>;
  totalResults: number;
}

/** §8 — hardware registry entry. */
export interface DeviceRecord {
  deviceId: string;
  category: HardwareCategory;
  identity: DeviceIdentity;
  categoryInfo: CategoryInfo;
  capabilities: HardwareCapability[];
  health: HealthSummary;
  lifecycleStage: LifecycleStage;
  runtimeState: RuntimeState;
  discoveryTimestamp: string;
  lastUpdated: string;
  owningAuthority: 'Hardware Authority';
  securityClassification: 'public' | 'internal';
}

export interface ReliabilityRecord {
  deviceId: string;
  errorCount: number;
  recoveryCount: number;
  lastErrorAt?: string;
  lastRecoveryAt?: string;
  stabilityScore: number;
}

export interface EfficiencyProfile {
  performancePerWatt?: number;
  thermalUnderLoadCelsius?: number;
}

export interface SuitabilityScore {
  deviceId: string;
  workload: HardwareCapability;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  explanation: string[];
}

/** Architect's Enhancement — digital twin assembled from every other subsystem's view of a device. */
export interface DigitalTwin {
  deviceId: string;
  identity: DeviceIdentity;
  capabilities: HardwareCapability[];
  health: HealthSummary;
  performanceProfile: BenchmarkSummary;
  operationalState: RuntimeState;
  reliability: ReliabilityRecord;
  efficiency: EfficiencyProfile;
  suitabilityScores: SuitabilityScore[];
}

export interface HardwareAuditRecord {
  timestamp: string;
  deviceId: string;
  kind:
    | 'discovered'
    | 'removed'
    | 'updated'
    | 'capability-changed'
    | 'driver-changed'
    | 'state-transition'
    | 'lifecycle-transition'
    | 'benchmark-recorded'
    | 'fault-detected'
    | 'recovery-recorded';
  details: Record<string, unknown>;
  reason?: string;
  initiatingAuthority?: string;
}

// ---- Raw discovery shapes (provider output, pre-classification) ----

export interface RawCpuInfo {
  manufacturer?: string;
  brand?: string;
  vendor?: string;
  family?: string;
  physicalCores?: number;
  cores?: number;
  cacheL1KB?: number;
  cacheL2KB?: number;
  cacheL3KB?: number;
  flags?: string[];
  virtualization?: boolean;
  currentLoadPercent?: number;
  speedMHz?: number;
  speedMinMHz?: number;
  speedMaxMHz?: number;
  temperatureCelsius?: number;
}

export interface RawGpuInfo {
  vendor?: string;
  model?: string;
  vramMB?: number;
  driverVersion?: string;
  bus?: string;
  temperatureCelsius?: number;
  powerLimitWatts?: number;
  fanSupport?: boolean;
}

export interface RawAsicInfo extends AsicInfo {
  deviceId?: string;
}

export interface RawMemoryInfo {
  totalMB?: number;
  freeMB?: number;
  ecc?: boolean;
}

export interface RawStorageDisk {
  type?: string;
  sizeMB?: number;
  availableMB?: number;
  smartStatus?: string;
}

export interface RawMotherboardInfo {
  manufacturer?: string;
  model?: string;
  biosVersion?: string;
  chipset?: string;
}

export interface RawNetworkInterface {
  name?: string;
  speedMbps?: number;
  operstate?: string;
}

export interface RawDiscoverySnapshot {
  cpu: RawCpuInfo[];
  gpu: RawGpuInfo[];
  asic: RawAsicInfo[];
  memory: RawMemoryInfo | null;
  storage: RawStorageDisk[];
  motherboard: RawMotherboardInfo | null;
  network: RawNetworkInterface[];
  discoveredAt: string;
}

export interface DiscoverySnapshot {
  readonly version: number;
  readonly createdAt: string;
  readonly devices: readonly DeviceRecord[];
}
