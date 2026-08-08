import type {
  CpuInfo,
  DeviceRecord,
  GpuInfo,
  HardwareCapability,
  HealthSummary,
  StorageInfo,
} from './types.js';

/**
 * §7 — Capability Assessment Engine. Deterministic, explainable rules mapping
 * observed device data to capability flags. Reasons about capabilities, not
 * identity (Law 2) — nothing here branches on a specific model string.
 */
export function assessCapabilities(device: DeviceRecord): HardwareCapability[] {
  switch (device.category) {
    case 'cpu': {
      const info = device.categoryInfo as CpuInfo;
      const caps: HardwareCapability[] = ['cpu-mining', 'benchmarking', 'hardware-telemetry'];
      if (info.virtualizationSupport) caps.push('virtualization');
      if (info.thermalSensors && info.thermalSensors.length > 0) caps.push('thermal-monitoring');
      return caps;
    }
    case 'gpu': {
      const info = device.categoryInfo as GpuInfo;
      const caps: HardwareCapability[] = ['benchmarking', 'hardware-telemetry'];
      if (typeof info.vramMB === 'number') caps.push('gpu-mining');
      // AI capability heuristic: CUDA support, or enough VRAM to be plausibly useful for
      // inference/training workloads. This is a coarse, documented heuristic — real
      // suitability is refined later by digitalTwin.ts's scoring, not decided here.
      if (info.cudaSupport || (typeof info.vramMB === 'number' && info.vramMB >= 4096)) {
        caps.push('ai-inference');
      }
      if (info.cudaSupport && typeof info.vramMB === 'number' && info.vramMB >= 8192) {
        caps.push('ai-training');
      }
      if (typeof info.temperatureCelsius === 'number') caps.push('thermal-monitoring');
      if (typeof info.powerLimitWatts === 'number') caps.push('power-monitoring');
      if (info.fanSupport) caps.push('fan-control');
      return caps;
    }
    case 'asic':
      return ['asic-mining', 'hardware-telemetry'];
    case 'memory':
    case 'storage':
    case 'motherboard':
    case 'network':
      return ['hardware-telemetry'];
    default:
      return [];
  }
}

/**
 * §4/§13 — Health assessment. Purely informational/diagnostic (explainability),
 * never a gating decision — enforcement of thermal/power limits against these
 * readings is Policy Authority's job (ADR-0006), not IHIS's.
 */
export function assessHealth(device: DeviceRecord, now: string): HealthSummary {
  const reasons: string[] = [];
  let status: HealthSummary['status'] = 'healthy';

  if (device.category === 'gpu') {
    const info = device.categoryInfo as GpuInfo;
    if (typeof info.temperatureCelsius === 'number') {
      if (info.temperatureCelsius >= 100) {
        status = 'faulted';
        reasons.push(`GPU temperature ${info.temperatureCelsius}°C at or above the faulted diagnostic threshold (100°C).`);
      } else if (info.temperatureCelsius >= 90) {
        status = 'degraded';
        reasons.push(`GPU temperature ${info.temperatureCelsius}°C at or above the degraded diagnostic threshold (90°C).`);
      }
    } else {
      reasons.push('No GPU temperature sensor reading available.');
      status = 'unknown';
    }
  }

  if (device.category === 'storage') {
    const info = device.categoryInfo as StorageInfo;
    if (info.smartStatus === 'failing') {
      status = 'faulted';
      reasons.push('SMART status reports failing.');
    } else if (info.health === 'warning') {
      status = status === 'healthy' ? 'degraded' : status;
      reasons.push('Storage health reported as warning.');
    } else if (info.smartStatus === 'unknown' && info.health === 'unknown') {
      status = 'unknown';
      reasons.push('No SMART or health signal available.');
    }
  }

  if (device.category === 'cpu') {
    const info = device.categoryInfo as CpuInfo;
    const cpuTemp = info.thermalSensors?.[0]?.celsius;
    if (typeof cpuTemp === 'number' && cpuTemp >= 95) {
      status = 'faulted';
      reasons.push(`CPU temperature ${cpuTemp}°C at or above the faulted diagnostic threshold (95°C).`);
    } else if (typeof cpuTemp === 'number' && cpuTemp >= 85) {
      status = status === 'healthy' ? 'degraded' : status;
      reasons.push(`CPU temperature ${cpuTemp}°C at or above the degraded diagnostic threshold (85°C).`);
    }
  }

  if (reasons.length === 0) reasons.push('No adverse signals observed.');

  return { status, reasons, lastCheckedAt: now };
}
