import type {
  BenchmarkSummary,
  DeviceRecord,
  DigitalTwin,
  EfficiencyProfile,
  HardwareCapability,
  HealthSummary,
  ReliabilityRecord,
  RuntimeState,
  SuitabilityScore,
} from './types.js';

const WORKLOAD_CAPABILITIES: HardwareCapability[] = ['cpu-mining', 'gpu-mining', 'asic-mining', 'ai-inference', 'ai-training', 'virtualization'];

function healthFactor(health: HealthSummary): number {
  switch (health.status) {
    case 'healthy':
      return 1.0;
    case 'degraded':
      return 0.5;
    case 'faulted':
      return 0.0;
    case 'unknown':
    default:
      return 0.75;
  }
}

function availabilityFactor(state: RuntimeState): number {
  if (state === 'available') return 1.0;
  if (state === 'offline' || state === 'faulted' || state === 'maintenance') return 0.0;
  return 0.3; // reserved/busy/benchmarking/mining/ai-workload — capable but currently occupied
}

export function initialReliability(deviceId: string): ReliabilityRecord {
  return { deviceId, errorCount: 0, recoveryCount: 0, stabilityScore: 1.0 };
}

export function recomputeStabilityScore(record: ReliabilityRecord): number {
  if (record.errorCount === 0) return 1.0;
  return Math.max(0, Math.min(1, record.recoveryCount / record.errorCount));
}

/**
 * Architect's Enhancement — deterministic, explainable suitability scoring.
 * Not machine learning: a documented weighted-factor formula over data IHIS
 * actually has (capability, health, availability, reliability), with
 * `confidence` communicating how much real benchmark evidence backs the score
 * rather than folding an unbenchmarked guess into the score itself.
 */
export function computeSuitability(
  device: DeviceRecord,
  workload: HardwareCapability,
  reliability: ReliabilityRecord,
  benchmarks: BenchmarkSummary,
): SuitabilityScore {
  if (!device.capabilities.includes(workload)) {
    return {
      deviceId: device.deviceId,
      workload,
      score: 0,
      confidence: 'high',
      explanation: [`Device lacks "${workload}" capability.`],
    };
  }

  const hFactor = healthFactor(device.health);
  const aFactor = availabilityFactor(device.runtimeState);
  const rFactor = reliability.stabilityScore;
  const score = (hFactor + aFactor + rFactor) / 3;

  const explanation: string[] = [
    `Device has "${workload}" capability.`,
    `Health status: ${device.health.status} (factor ${hFactor.toFixed(2)}).`,
    `Runtime state: ${device.runtimeState} (factor ${aFactor.toFixed(2)}).`,
    reliability.errorCount === 0
      ? 'Reliability: no errors recorded (default full stability).'
      : `Reliability: ${reliability.recoveryCount}/${reliability.errorCount} errors recovered (factor ${rFactor.toFixed(2)}).`,
  ];

  const benchmark = benchmarks.latestByWorkload[workload];
  let confidence: SuitabilityScore['confidence'] = 'low';
  if (benchmark) {
    confidence = 'high';
    explanation.push(`Benchmark recorded: ${benchmark.value} ${benchmark.unit} (${benchmark.metric}) at ${benchmark.recordedAt}.`);
  } else if (device.health.status !== 'unknown') {
    confidence = 'medium';
    explanation.push('No benchmark data yet for this workload — score based on capability, health, and availability only.');
  } else {
    explanation.push('No benchmark data and unknown health — low-confidence estimate.');
  }

  return { deviceId: device.deviceId, workload, score, confidence, explanation };
}

export function computeEfficiencyProfile(device: DeviceRecord, benchmarks: BenchmarkSummary): EfficiencyProfile {
  const powerWatts = (device.categoryInfo as { powerLimitWatts?: number }).powerLimitWatts;
  const thermalCelsius = (device.categoryInfo as { temperatureCelsius?: number }).temperatureCelsius;
  const bestBenchmark = Object.values(benchmarks.bestByWorkload)[0];

  return {
    performancePerWatt: bestBenchmark && powerWatts ? bestBenchmark.value / powerWatts : undefined,
    thermalUnderLoadCelsius: device.runtimeState === 'mining' || device.runtimeState === 'benchmarking' ? thermalCelsius : undefined,
  };
}

export function assembleDigitalTwin(
  device: DeviceRecord,
  reliability: ReliabilityRecord,
  benchmarks: BenchmarkSummary,
): DigitalTwin {
  const suitabilityScores = WORKLOAD_CAPABILITIES.filter((workload) => device.capabilities.includes(workload)).map((workload) =>
    computeSuitability(device, workload, reliability, benchmarks),
  );

  return {
    deviceId: device.deviceId,
    identity: device.identity,
    capabilities: device.capabilities,
    health: device.health,
    performanceProfile: benchmarks,
    operationalState: device.runtimeState,
    reliability,
    efficiency: computeEfficiencyProfile(device, benchmarks),
    suitabilityScores,
  };
}
