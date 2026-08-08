/** §4 — categories are data, not category-specific authority classes. */
export type BenchmarkCategory = 'hardware' | 'mining' | 'platform';
export type BenchmarkDirection = 'higher-is-better' | 'lower-is-better';

export type BenchmarkLifecycleState =
  | 'created'
  | 'validated'
  | 'scheduled'
  | 'executed'
  | 'verified'
  | 'stored'
  | 'compared'
  | 'archived';

export interface BenchmarkTypeDefinition {
  typeId: string;
  category: BenchmarkCategory;
  name: string;
  version: string;
  componentKinds: string[];
  metric: string;
  unit: string;
  direction: BenchmarkDirection;
  description: string;
  active: boolean;
  createdAt: string;
}

/** The structural shape of Phase 03's certified BenchmarkRegistry record. */
export interface HardwareBenchmarkResult {
  deviceId: string;
  workload: string;
  metric: string;
  value: number;
  unit: string;
  recordedAt: string;
}

export interface HardwareBenchmarkSummary {
  latestByWorkload: Record<string, HardwareBenchmarkResult>;
  bestByWorkload: Record<string, HardwareBenchmarkResult>;
  totalResults: number;
}

export interface BenchmarkEnvironment {
  operatingSystem?: string;
  runtimeVersion?: string;
  databaseVersion?: string;
  eventBusVersion?: string;
  schedulerVersion?: string;
  miningAlgorithm?: string;
  configuration?: Record<string, string | number | boolean>;
  labels?: Record<string, string>;
}

export interface HardwareProfile {
  deviceId: string;
  model?: string;
  vendor?: string;
  driverVersion?: string;
  firmwareVersion?: string;
  configuration?: Record<string, string | number | boolean>;
}

export interface PowerProfile {
  averageWatts?: number;
  peakWatts?: number;
  energyWh?: number;
  source?: string;
}

export interface ThermalProfile {
  averageCelsius?: number;
  peakCelsius?: number;
  ambientCelsius?: number;
  source?: string;
}

export interface BenchmarkRunInput {
  benchmarkTypeId: string;
  benchmarkVersion: string;
  component: string;
  deviceId: string;
  reason: string;
  environment?: BenchmarkEnvironment;
  hardwareProfile?: HardwareProfile;
  powerProfile?: PowerProfile;
  thermalProfile?: ThermalProfile;
}

/** §6 — orchestration evidence, not a second raw BenchmarkResult persistence array. */
export interface BenchmarkRun {
  runId: string;
  benchmarkTypeId: string;
  benchmarkVersion: string;
  category: BenchmarkCategory;
  component: string;
  deviceId: string;
  state: BenchmarkLifecycleState;
  reason: string;
  createdAt: string;
  validatedAt?: string;
  scheduledFor?: string;
  executedAt?: string;
  verifiedAt?: string;
  storedAt?: string;
  comparedAt?: string;
  archivedAt?: string;
  durationMs?: number;
  result?: HardwareBenchmarkResult;
  environment: BenchmarkEnvironment;
  hardwareProfile: HardwareProfile;
  powerProfile: PowerProfile;
  thermalProfile: ThermalProfile;
  verificationNotes?: string[];
  failureReason?: string;
  rawResultStoredBy: 'IHIS BenchmarkRegistry' | undefined;
}

export interface BenchmarkLifecycleRecord {
  runId: string;
  from: BenchmarkLifecycleState | undefined;
  to: BenchmarkLifecycleState;
  at: string;
  reason: string;
}

export interface BenchmarkComparison {
  comparisonId: string;
  runId: string;
  baselineRunId?: string;
  metric: string;
  unit: string;
  currentValue: number;
  baselineValue?: number;
  directionalChange: number;
  directionalChangePercent?: number;
  classification: 'improved' | 'stable' | 'regressed' | 'no-baseline';
  regressionDetected: boolean;
  baselineDescription: string;
  comparedAt: string;
}

export interface BenchmarkRecommendation {
  recommendationId: string;
  runId: string;
  createdAt: string;
  recommendation: string;
  rationale: string[];
  advisory: true;
}

export interface BenchmarkExplanation {
  runId: string;
  whatWasMeasured: string;
  why: string;
  conditions: string;
  baseline: string;
  whatChanged: string;
  recommendation: string;
  lifecycle: BenchmarkLifecycleRecord[];
}

/** Provider-returned signals remain owned by their source authority. */
export interface ResourceSignal {
  utilizationPercent?: number;
  allocatedUnits?: number;
  availableUnits?: number;
  source?: string;
}

export interface WorkloadSignal {
  workloadId?: string;
  characteristics?: string[];
  miningAlgorithm?: string;
  runtimeVersion?: string;
  configurationChanges?: string[];
  source?: string;
}

export interface BenchmarkCorrelation {
  hardwareConfiguration: HardwareProfile;
  resource?: ResourceSignal;
  power?: PowerProfile;
  thermal?: ThermalProfile;
  workload?: WorkloadSignal;
  environment: BenchmarkEnvironment;
}

/** §11 — IPKB record is a governed institutional correlation/history artifact. */
export interface InstitutionalPerformanceKnowledgeRecord {
  knowledgeId: string;
  runId: string;
  recordedAt: string;
  benchmarkTypeId: string;
  benchmarkVersion: string;
  category: BenchmarkCategory;
  component: string;
  deviceId: string;
  metric: string;
  value: number;
  unit: string;
  correlation: BenchmarkCorrelation;
  comparison?: BenchmarkComparison;
}

export interface IPKBQuery {
  benchmarkTypeId?: string;
  component?: string;
  deviceId?: string;
  metric?: string;
  miningAlgorithm?: string;
  runtimeVersion?: string;
  configurationChange?: string;
}

export interface EfficiencyFinding {
  knowledgeId: string;
  runId: string;
  component: string;
  deviceId: string;
  metric: string;
  value: number;
  unit: string;
  watts: number;
  valuePerWatt: number;
  miningAlgorithm?: string;
}

/** Contracts used at composition time; no concrete authority is imported here. */
export interface HardwareBenchmarkStore {
  record(result: HardwareBenchmarkResult): void;
  forDevice(deviceId: string): HardwareBenchmarkResult[];
  summarize(deviceId: string): HardwareBenchmarkSummary;
}

export interface PowerSignalProvider {
  getPowerProfile(run: BenchmarkRun): PowerProfile | undefined;
}

export interface ThermalSignalProvider {
  getThermalProfile(run: BenchmarkRun): ThermalProfile | undefined;
}

export interface ResourceSignalProvider {
  getResourceSignal(run: BenchmarkRun): ResourceSignal | undefined;
}

export interface WorkloadSignalProvider {
  getWorkloadSignal(run: BenchmarkRun): WorkloadSignal | undefined;
}

export interface BenchmarkProviders {
  hardwareStore?: HardwareBenchmarkStore;
  power?: PowerSignalProvider;
  thermal?: ThermalSignalProvider;
  resource?: ResourceSignalProvider;
  workload?: WorkloadSignalProvider;
}
