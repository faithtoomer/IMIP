import type { DeviceRecord } from './types.js';

export interface IntegrityIssue {
  deviceId: string;
  issue: string;
}

/** §15 — detect duplicate device ids within a single classification batch, before
 * they reach the registry. A collision here means two distinct raw devices hashed
 * to the same id — most likely two devices with identical vendor+model and no
 * serial to disambiguate them (see classification.ts's computeDeviceId). Purely
 * diagnostic: callers decide how to respond, this only detects and reports. */
export function detectDuplicateDeviceIds(devices: DeviceRecord[]): IntegrityIssue[] {
  const counts = new Map<string, number>();
  for (const device of devices) {
    counts.set(device.deviceId, (counts.get(device.deviceId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([deviceId, count]) => ({ deviceId, issue: `${count} discovered devices collided on the same deviceId.` }));
}

/** §15 — detect internally inconsistent registry state: field combinations that
 * should never co-occur under normal operation. Purely diagnostic — never mutates
 * or blocks anything; it only makes an anomaly visible instead of silent. */
export function detectInventoryInconsistencies(devices: DeviceRecord[]): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const activeRuntimeStates = new Set(['mining', 'ai-workload', 'benchmarking', 'busy']);

  for (const device of devices) {
    if (device.lifecycleStage === 'retired' && device.runtimeState !== 'offline') {
      issues.push({
        deviceId: device.deviceId,
        issue: `Device is retired but runtime state is "${device.runtimeState}", expected "offline".`,
      });
    }

    if (activeRuntimeStates.has(device.runtimeState) && (device.lifecycleStage === 'discovered' || device.lifecycleStage === 'registered')) {
      issues.push({
        deviceId: device.deviceId,
        issue: `Device is runtime-"${device.runtimeState}" but lifecycle stage is only "${device.lifecycleStage}" (not yet capability-assessed).`,
      });
    }

    if (device.allocation && device.lifecycleStage !== 'allocated') {
      issues.push({
        deviceId: device.deviceId,
        issue: `Device carries an allocation record but lifecycle stage is "${device.lifecycleStage}", expected "allocated".`,
      });
    }
  }

  return issues;
}
