import type { ThermalAnomaly, ThermalHistoryPoint, ThermalProfile, ThermalTrend } from './types.js';

const SPIKE_THRESHOLD_CELSIUS = 15;
const IDLE_DEVIATION_THRESHOLD_CELSIUS = 20;
const OSCILLATION_THRESHOLD = 3;

let anomalyCounter = 0;

function nextAnomalyId(): string {
  anomalyCounter += 1;
  return `anomaly-${anomalyCounter}-${Date.now()}`;
}

export function resetAnomalyCounter(): void {
  anomalyCounter = 0;
}

export interface AnomalyDetectionInput {
  profile: ThermalProfile;
  history: ThermalHistoryPoint[];
  previousProfile?: ThermalProfile;
  trend?: ThermalTrend;
}

export function detectAnomalies(input: AnomalyDetectionInput): ThermalAnomaly[] {
  const { profile, history, previousProfile, trend } = input;
  const anomalies: ThermalAnomaly[] = [];
  const now = new Date().toISOString();

  if (!profile.sensorAvailable) {
    anomalies.push({
      id: nextAnomalyId(),
      kind: 'sensor-failure',
      deviceId: profile.deviceId,
      severity: 'high',
      evidence: { reason: 'Sensor reported unavailable' },
      detectedAt: now,
    });
    return anomalies;
  }

  if (previousProfile && profile.currentCelsius - previousProfile.currentCelsius >= SPIKE_THRESHOLD_CELSIUS) {
    anomalies.push({
      id: nextAnomalyId(),
      kind: 'temperature-spike',
      deviceId: profile.deviceId,
      severity: 'high',
      evidence: {
        previousCelsius: previousProfile.currentCelsius,
        currentCelsius: profile.currentCelsius,
        delta: profile.currentCelsius - previousProfile.currentCelsius,
      },
      detectedAt: now,
    });
  }

  if (profile.idleCelsius !== undefined && profile.currentCelsius - profile.idleCelsius >= IDLE_DEVIATION_THRESHOLD_CELSIUS) {
    const isLowLoad = profile.fanRpm !== undefined && profile.fanRpm < 1000;
    if (isLowLoad || profile.fanRpm === undefined) {
      anomalies.push({
        id: nextAnomalyId(),
        kind: 'unexpected-idle-temp',
        deviceId: profile.deviceId,
        severity: 'medium',
        evidence: {
          idleCelsius: profile.idleCelsius,
          currentCelsius: profile.currentCelsius,
          fanRpm: profile.fanRpm,
        },
        detectedAt: now,
      });
    }
  }

  if (history.length >= 4) {
    let directionChanges = 0;
    let prevDirection = 0;
    for (let i = 1; i < history.length; i++) {
      const delta = history[i].celsius - history[i - 1].celsius;
      const direction = delta > 0.5 ? 1 : delta < -0.5 ? -1 : 0;
      if (direction !== 0 && prevDirection !== 0 && direction !== prevDirection) {
        directionChanges += 1;
      }
      if (direction !== 0) prevDirection = direction;
    }
    if (directionChanges >= OSCILLATION_THRESHOLD) {
      anomalies.push({
        id: nextAnomalyId(),
        kind: 'oscillation',
        deviceId: profile.deviceId,
        severity: 'medium',
        evidence: { directionChanges, windowPoints: history.length },
        detectedAt: now,
      });
    }
  }

  if (profile.fanRpm !== undefined && profile.thermalState !== 'nominal') {
    if (profile.fanRpm < 500 && profile.currentCelsius > 70) {
      anomalies.push({
        id: nextAnomalyId(),
        kind: 'fan-anomaly',
        deviceId: profile.deviceId,
        severity: 'high',
        evidence: { fanRpm: profile.fanRpm, currentCelsius: profile.currentCelsius },
        detectedAt: now,
      });
    }
  }

  if (history.length >= 3) {
    const recent = history.slice(-3);
    const allRising = recent.every((p, i) => i === 0 || p.celsius > recent[i - 1].celsius);
    if (allRising && profile.thermalState === 'warning') {
      anomalies.push({
        id: nextAnomalyId(),
        kind: 'abnormal-heating',
        deviceId: profile.deviceId,
        severity: 'high',
        evidence: { trend: 'sustained-rise', currentCelsius: profile.currentCelsius },
        detectedAt: now,
      });
    }
  }

  if (
    trend &&
    trend.heatAccumulationRate > 0.5 &&
    trend.coolingRate < trend.heatAccumulationRate * 0.3 &&
    profile.thermalState !== 'nominal'
  ) {
    anomalies.push({
      id: nextAnomalyId(),
      kind: 'cooling-degradation',
      deviceId: profile.deviceId,
      severity: 'medium',
      evidence: {
        heatAccumulationRate: trend.heatAccumulationRate,
        coolingRate: trend.coolingRate,
      },
      detectedAt: now,
    });
  }

  return anomalies;
}
