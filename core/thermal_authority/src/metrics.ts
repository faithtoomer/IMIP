import type { ThermalMetrics, ThermalProfile } from './types.js';

export class MetricsCollector {
  private devicesMonitored = 0;
  private devicesNominal = 0;
  private devicesElevated = 0;
  private devicesWarning = 0;
  private devicesCritical = 0;
  private devicesUnknown = 0;
  private sensorsUnavailable = 0;
  private anomaliesDetected = 0;
  private recommendationsGenerated = 0;
  private forecastsGenerated = 0;
  private budgetViolations = 0;
  private temperatureSum = 0;
  private peakTemperature = 0;

  recordProfile(profile: ThermalProfile): void {
    this.devicesMonitored += 1;
    this.temperatureSum += profile.currentCelsius;
    if (profile.currentCelsius > this.peakTemperature) {
      this.peakTemperature = profile.currentCelsius;
    }

    switch (profile.thermalState) {
      case 'nominal':
        this.devicesNominal += 1;
        break;
      case 'elevated':
        this.devicesElevated += 1;
        break;
      case 'warning':
        this.devicesWarning += 1;
        break;
      case 'critical':
        this.devicesCritical += 1;
        break;
      case 'unknown':
        this.devicesUnknown += 1;
        break;
    }

    if (!profile.sensorAvailable) {
      this.sensorsUnavailable += 1;
    }
  }

  recordAnomaly(): void {
    this.anomaliesDetected += 1;
  }

  recordRecommendation(count = 1): void {
    this.recommendationsGenerated += count;
  }

  recordForecast(): void {
    this.forecastsGenerated += 1;
  }

  recordBudgetViolation(): void {
    this.budgetViolations += 1;
  }

  reset(): void {
    this.devicesMonitored = 0;
    this.devicesNominal = 0;
    this.devicesElevated = 0;
    this.devicesWarning = 0;
    this.devicesCritical = 0;
    this.devicesUnknown = 0;
    this.sensorsUnavailable = 0;
    this.anomaliesDetected = 0;
    this.recommendationsGenerated = 0;
    this.forecastsGenerated = 0;
    this.budgetViolations = 0;
    this.temperatureSum = 0;
    this.peakTemperature = 0;
  }

  snapshot(): ThermalMetrics {
    return {
      devicesMonitored: this.devicesMonitored,
      devicesNominal: this.devicesNominal,
      devicesElevated: this.devicesElevated,
      devicesWarning: this.devicesWarning,
      devicesCritical: this.devicesCritical,
      devicesUnknown: this.devicesUnknown,
      sensorsUnavailable: this.sensorsUnavailable,
      anomaliesDetected: this.anomaliesDetected,
      recommendationsGenerated: this.recommendationsGenerated,
      forecastsGenerated: this.forecastsGenerated,
      averageTemperatureCelsius: this.devicesMonitored > 0 ? this.temperatureSum / this.devicesMonitored : 0,
      peakTemperatureCelsius: this.peakTemperature,
      budgetViolations: this.budgetViolations,
    };
  }
}
