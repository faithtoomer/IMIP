import { createHash } from 'node:crypto';
import type {
  AsicInfo,
  CategoryInfo,
  CpuInfo,
  DeviceIdentity,
  DeviceRecord,
  GpuInfo,
  HardwareCategory,
  MemoryInfo,
  MotherboardInfo,
  NetworkInfo,
  RawDiscoverySnapshot,
  StorageInfo,
} from './types.js';

/** Stable-when-possible device id: prefers a hash of vendor+model+serial (survives
 * reordering across discover() calls); falls back to a positional id when no
 * identifying data is available (documented instability — see classification.test.ts). */
function computeDeviceId(category: HardwareCategory, index: number, identity: DeviceIdentity): string {
  const identifying = [identity.vendor, identity.model, identity.serial].filter(Boolean).join('|');
  if (!identifying) return `${category}-${index}`;
  const hash = createHash('sha256').update(identifying).digest('hex').slice(0, 12);
  return `${category}-${hash}`;
}

function baseFields(category: HardwareCategory, index: number, identity: DeviceIdentity, categoryInfo: CategoryInfo, timestamp: string): DeviceRecord {
  return {
    deviceId: computeDeviceId(category, index, identity),
    category,
    identity,
    categoryInfo,
    capabilities: [],
    health: { status: 'unknown', reasons: ['not yet assessed'], lastCheckedAt: timestamp },
    lifecycleStage: 'discovered',
    runtimeState: 'offline',
    discoveryTimestamp: timestamp,
    lastUpdated: timestamp,
    owningAuthority: 'Hardware Authority',
    securityClassification: identity.serial ? 'internal' : 'public',
  };
}

/** §6 — Hardware Classification Engine: normalizes raw provider output into DeviceRecord[]
 * with identity + category-specific info populated. Capability/health assessment happen in
 * a later pipeline stage (assessment.ts), matching the layered architecture in §5. */
export function classifyDevices(raw: RawDiscoverySnapshot): DeviceRecord[] {
  const timestamp = raw.discoveredAt;
  const devices: DeviceRecord[] = [];

  raw.cpu.forEach((cpu, index) => {
    const identity: DeviceIdentity = { vendor: cpu.manufacturer ?? cpu.vendor, model: cpu.brand, architecture: cpu.family };
    const info: CpuInfo = {
      manufacturer: cpu.manufacturer ?? cpu.vendor,
      model: cpu.brand,
      architecture: cpu.family,
      physicalCores: cpu.physicalCores,
      logicalCores: cpu.cores,
      cacheHierarchyKB: { l1: cpu.cacheL1KB, l2: cpu.cacheL2KB, l3: cpu.cacheL3KB },
      instructionSets: cpu.flags,
      virtualizationSupport: cpu.virtualization,
      currentUtilizationPercent: cpu.currentLoadPercent,
      frequencyMHz: { current: cpu.speedMHz, min: cpu.speedMinMHz, max: cpu.speedMaxMHz },
      thermalSensors: typeof cpu.temperatureCelsius === 'number' ? [{ label: 'cpu-package', celsius: cpu.temperatureCelsius }] : [],
    };
    devices.push(baseFields('cpu', index, identity, info, timestamp));
  });

  raw.gpu.forEach((gpu, index) => {
    const identity: DeviceIdentity = { vendor: gpu.vendor, model: gpu.model, driver: gpu.driverVersion };
    const info: GpuInfo = {
      vendor: gpu.vendor,
      model: gpu.model,
      vramMB: gpu.vramMB,
      cudaSupport: gpu.vendor?.toLowerCase().includes('nvidia') || undefined,
      openClSupport: undefined,
      driverVersion: gpu.driverVersion,
      pcie: gpu.bus ? { generation: undefined, laneWidth: undefined } : undefined,
      powerLimitWatts: gpu.powerLimitWatts,
      fanSupport: gpu.fanSupport,
      temperatureCelsius: gpu.temperatureCelsius,
    };
    devices.push(baseFields('gpu', index, identity, info, timestamp));
  });

  raw.asic.forEach((asic, index) => {
    const identity: DeviceIdentity = { vendor: asic.vendor, model: asic.model, firmware: asic.firmware, serial: asic.deviceId };
    const info: AsicInfo = {
      vendor: asic.vendor,
      model: asic.model,
      firmware: asic.firmware,
      hashBoards: asic.hashBoards,
      coolingType: asic.coolingType,
      fanStatus: asic.fanStatus,
      poolConnectivity: asic.poolConnectivity ?? 'unknown',
    };
    devices.push(baseFields('asic', index, identity, info, timestamp));
  });

  if (raw.memory) {
    const identity: DeviceIdentity = {};
    const info: MemoryInfo = {
      installedCapacityMB: raw.memory.totalMB,
      availableMB: raw.memory.freeMB,
      eccSupported: raw.memory.ecc,
      utilizationPercent:
        raw.memory.totalMB && raw.memory.freeMB !== undefined
          ? ((raw.memory.totalMB - raw.memory.freeMB) / raw.memory.totalMB) * 100
          : undefined,
    };
    devices.push(baseFields('memory', 0, identity, info, timestamp));
  }

  raw.storage.forEach((disk, index) => {
    const identity: DeviceIdentity = {};
    const info: StorageInfo = {
      deviceType: (disk.type?.toLowerCase() as StorageInfo['deviceType']) ?? 'unknown',
      capacityMB: disk.sizeMB,
      availableMB: disk.availableMB,
      health: disk.smartStatus === 'Ok' ? 'healthy' : disk.smartStatus ? 'warning' : 'unknown',
      smartStatus: disk.smartStatus === 'Ok' ? 'ok' : disk.smartStatus ? 'failing' : 'unknown',
    };
    devices.push(baseFields('storage', index, identity, info, timestamp));
  });

  if (raw.motherboard) {
    const identity: DeviceIdentity = { vendor: raw.motherboard.manufacturer, model: raw.motherboard.model, firmware: raw.motherboard.biosVersion };
    const info: MotherboardInfo = {
      manufacturer: raw.motherboard.manufacturer,
      model: raw.motherboard.model,
      biosVersion: raw.motherboard.biosVersion,
      chipset: raw.motherboard.chipset,
    };
    devices.push(baseFields('motherboard', 0, identity, info, timestamp));
  }

  raw.network.forEach((iface, index) => {
    const identity: DeviceIdentity = { model: iface.name };
    const info: NetworkInfo = {
      interfaceName: iface.name,
      speedMbps: iface.speedMbps,
      linkStatus: iface.operstate === 'up' ? 'up' : iface.operstate === 'down' ? 'down' : 'unknown',
      connectivityState: iface.operstate === 'up' ? 'connected' : iface.operstate === 'down' ? 'disconnected' : 'unknown',
    };
    devices.push(baseFields('network', index, identity, info, timestamp));
  });

  return devices;
}
