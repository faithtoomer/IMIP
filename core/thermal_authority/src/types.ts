export type ThermalDomain = 'cpu' | 'gpu' | 'asic' | 'platform';

export type ThermalState = 'nominal' | 'elevated' | 'warning' | 'critical' | 'unknown';

export type ThermalLifecycleStage =
  | 'discovered'
  | 'profiled'
  | 'monitored'
  | 'analyzed'
  | 'forecasted'
  | 'recommended'
  | 'archived';

export interface ThermalProfile {
  deviceId: string;
  deviceType: ThermalDomain;
  currentCelsius: number;
  coreCelsius?: number;
  memoryCelsius?: number;
  hotspotCelsius?: number;
  vrmCelsius?: number;
  fanRpm?: number;
  ambientCelsius?: number;
  idleCelsius?: number;
  averageCelsius?: number;
  peakCelsius?: number;
  minCelsius?: number;
  thermalState: ThermalState;
  lifecycleStage: ThermalLifecycleStage;
  lastUpdated: string;
  sensorAvailable: boolean;
}

export interface ThermalBudget {
  id: string;
  scope: ThermalDomain | string;
  operatingTargetCelsius: number;
  warningThresholdCelsius: number;
  criticalThresholdCelsius: number;
  currentCelsius?: number;
}

export interface ThermalTrend {
  slopeCelsiusPerMinute: number;
  heatAccumulationRate: number;
  coolingRate: number;
  cyclingFrequency: number;
  window: string;
}

export interface ThermalForecast {
  expectedCelsius: number;
  minutesToWarning?: number;
  minutesToCritical?: number;
  coolingRequirementNote?: string;
  longTermDriftCelsius?: number;
  generatedAt: string;
}

export type ThermalAnomalyKind =
  | 'temperature-spike'
  | 'sensor-failure'
  | 'cooling-degradation'
  | 'fan-anomaly'
  | 'oscillation'
  | 'abnormal-heating'
  | 'unexpected-idle-temp';

export interface ThermalAnomaly {
  id: string;
  kind: ThermalAnomalyKind;
  deviceId: string;
  severity: 'low' | 'medium' | 'high';
  evidence: Record<string, unknown>;
  detectedAt: string;
}

export interface ThermalRecommendation {
  id: string;
  deviceId?: string;
  action: string;
  rationale: string;
  supportingEvidence: Record<string, unknown>;
  generatedAt: string;
  advisory: true;
}

export interface ThermalSample {
  deviceId: string;
  deviceType: ThermalDomain;
  celsius: number;
  coreCelsius?: number;
  memoryCelsius?: number;
  hotspotCelsius?: number;
  vrmCelsius?: number;
  fanRpm?: number;
  ambientCelsius?: number;
  collectedAt: string;
  sensorAvailable: boolean;
}

export interface ThermalHistoryPoint {
  deviceId: string;
  celsius: number;
  fanRpm?: number;
  recordedAt: string;
}

export interface ThermalAssessment {
  deviceId: string;
  profile: ThermalProfile;
  sensors: {
    available: boolean;
    coreCelsius?: number;
    memoryCelsius?: number;
    hotspotCelsius?: number;
    vrmCelsius?: number;
    fanRpm?: number;
    ambientCelsius?: number;
  };
  trend: ThermalTrend | null;
  budget: ThermalBudget | null;
  forecast: ThermalForecast | null;
  recommendations: ThermalRecommendation[];
  anomalies: ThermalAnomaly[];
  evidence: string[];
}

export interface ThermalAuditRecord {
  timestamp: string;
  deviceId: string;
  kind:
    | 'device-registered'
    | 'profile-updated'
    | 'state-changed'
    | 'lifecycle-transition'
    | 'budget-set'
    | 'anomaly-detected'
    | 'forecast-generated'
    | 'recommendation-generated'
    | 'sensor-unavailable'
    | 'budget-exceeded'
    | 'recovered';
  details: Record<string, unknown>;
  reason?: string;
  initiatingAuthority?: string;
}

export interface ThermalMetrics {
  devicesMonitored: number;
  devicesNominal: number;
  devicesElevated: number;
  devicesWarning: number;
  devicesCritical: number;
  devicesUnknown: number;
  sensorsUnavailable: number;
  anomaliesDetected: number;
  recommendationsGenerated: number;
  forecastsGenerated: number;
  averageTemperatureCelsius: number;
  peakTemperatureCelsius: number;
  budgetViolations: number;
}

/** Institutional Thermal Digital Twin — descriptive and predictive, never controlling. */
export interface ThermalDigitalTwin {
  deviceId: string;
  profile: ThermalProfile;
  trend: ThermalTrend | null;
  forecast: ThermalForecast | null;
  budget: ThermalBudget | null;
  anomalies: ThermalAnomaly[];
  recommendations: ThermalRecommendation[];
  powerSnapshot: PowerSnapshotForThermal | null;
  historySummary: {
    pointCount: number;
    averageCelsius: number;
    peakCelsius: number;
    minCelsius: number;
    variance: number;
  };
  assessment: ThermalAssessment;
}

/** Cross-domain power snapshot — interface only; no direct IPIA import. */
export interface PowerSnapshotForThermal {
  deviceId: string;
  watts?: number;
  capturedAt: string;
}
