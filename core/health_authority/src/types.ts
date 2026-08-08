/** §1/§3 — component kinds covered by IHIA's generic institutional registry. */
export type HealthComponentType =
  | 'hardware'
  | 'resource'
  | 'workload'
  | 'plugin'
  | 'authority'
  | 'runtime'
  | 'storage'
  | 'database'
  | 'communications';

/** §5 — operational health categories monitored by IHIA. */
export type HealthCategory =
  | 'hardware'
  | 'resource'
  | 'thermal'
  | 'power'
  | 'runtime'
  | 'plugin'
  | 'database'
  | 'storage'
  | 'event-bus'
  | 'scheduler';

export type InstitutionalHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';
export type ReliabilityTrend = 'improving' | 'stable' | 'declining' | 'unknown';

/** Scores have a fixed 0–100 scale; only the weighting used to compose them varies. */
export interface HealthScore {
  overallScore: number;
  reliabilityScore: number;
  stabilityScore: number;
  performanceScore: number;
  availabilityScore: number;
  status: InstitutionalHealthStatus;
}

/** Source-owned measurements supplied through a provider contract. IHIA never detects these raw conditions. */
export interface HealthSignalMetrics {
  overallScore?: number;
  reliabilityScore?: number;
  stabilityScore?: number;
  performanceScore?: number;
  availabilityScore?: number;
}

export interface HealthMaintenanceRecord {
  occurredAt: string;
  kind: 'inspection' | 'maintenance' | 'repair' | 'recovery';
  summary: string;
  providerSource: string;
}

/** The deliberately small, authority-neutral input contract for every external health source. */
export interface HealthObservation {
  componentId: string;
  componentType: HealthComponentType;
  providerSource: string;
  observedAt: string;
  categories: HealthCategory[];
  metrics: HealthSignalMetrics;
  failureCount?: number;
  mtbfHours?: number;
  availabilityPercent?: number;
  reliabilityTrend?: ReliabilityTrend;
  lastInspection?: string;
  maintenanceHistory?: HealthMaintenanceRecord[];
  evidence?: string[];
}

export interface HealthHistoryEntry {
  observedAt: string;
  score: HealthScore;
  evidence: string[];
  providerSource: string;
}

/** §4 — one generic health record per component-type / component-id / provider-source identity. */
export interface HealthProfile {
  profileId: string;
  componentId: string;
  componentType: HealthComponentType;
  providerSource: string;
  categories: HealthCategory[];
  currentHealth: HealthScore;
  historicalHealth: HealthHistoryEntry[];
  failureCount: number;
  mtbfHours?: number;
  availabilityPercent?: number;
  reliabilityTrend: ReliabilityTrend;
  lastInspection: string;
  maintenanceHistory: HealthMaintenanceRecord[];
  evidence: string[];
  createdAt: string;
  lastUpdated: string;
}

/** Weights are injectable/swappable, allowing Configuration Authority wiring without coupling to it. */
export interface HealthScoreWeights {
  reliability: number;
  stability: number;
  performance: number;
  availability: number;
}

export interface HealthForecast {
  profileId: string;
  componentId: string;
  providerSource: string;
  forecastedAt: string;
  degradationTrend: 'improving' | 'stable' | 'degrading' | 'unknown';
  scoreChangePerObservation?: number;
  expectedFailure: boolean;
  expectedFailureAt?: string;
  confidence: number;
  maintenanceRecommendation: string;
  basis: string[];
  advisory: true;
}

export interface HealthAssessmentRecord {
  timestamp: string;
  profileId: string;
  registryKey: string;
  kind: 'assessed' | 'weights-updated';
  reason: string;
  evidence: string[];
  previousScore?: HealthScore;
  currentScore?: HealthScore;
}

export interface HealthExplanation {
  profileId: string;
  whatChanged: string;
  why: string;
  supportingEvidence: string[];
  historicalTrend: string;
  forecast: string;
  recommendedAction: string;
  evidence: HealthAssessmentRecord[];
}

export interface HealthTwinDimension {
  category: HealthCategory;
  profileCount: number;
  averageScore?: number;
  statuses: Record<InstitutionalHealthStatus, number>;
  evidence: string[];
}

/** §11 — continuously refreshed institutional read model. It remains advisory and read-only. */
export interface InstitutionalHealthDigitalTwin {
  twinId: 'institutional-health';
  updatedAt: string;
  institutionalScore?: HealthScore;
  componentProfiles: HealthProfile[];
  dimensions: Record<HealthCategory, HealthTwinDimension>;
  reliabilityHistory: Array<Pick<HealthProfile, 'profileId' | 'reliabilityTrend' | 'failureCount' | 'mtbfHours'>>;
  maintenanceHistory: HealthMaintenanceRecord[];
  forecasts: HealthForecast[];
}

/** Minimal external read contracts. Composition wiring adapts published authority data to these shapes. */
export interface HealthSignalProvider {
  getHealthSignals(): HealthObservation[];
}
export interface HardwareHealthProvider extends HealthSignalProvider {}
export interface ResourceHealthProvider extends HealthSignalProvider {}
export interface WorkloadHealthProvider extends HealthSignalProvider {}
export interface PowerHealthProvider extends HealthSignalProvider {}
export interface ThermalHealthProvider extends HealthSignalProvider {}

export interface HealthProviders {
  hardware?: HardwareHealthProvider;
  resource?: ResourceHealthProvider;
  workload?: WorkloadHealthProvider;
  power?: PowerHealthProvider;
  thermal?: ThermalHealthProvider;
  additional?: HealthSignalProvider[];
}
