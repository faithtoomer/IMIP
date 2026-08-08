import * as si from 'systeminformation';
import type {
  RawAsicInfo,
  RawCpuInfo,
  RawDiscoverySnapshot,
  RawGpuInfo,
  RawMemoryInfo,
  RawMotherboardInfo,
  RawNetworkInterface,
  RawStorageDisk,
} from './types.js';

export interface DiscoveryFailure {
  category: string;
  message: string;
}

export interface DiscoveryOutcome {
  snapshot: RawDiscoverySnapshot;
  failures: DiscoveryFailure[];
}

export interface DiscoveryProvider {
  discover(): Promise<DiscoveryOutcome>;
}

/** §6 — architecture must support ASICs even if none are present. No generic OS-level ASIC
 * enumeration exists (ASICs are network-attached miners, not local PCIe/USB devices with a
 * standard discovery API); this is a real, pluggable extension point that returns an empty
 * list by design until a concrete ASIC discovery backend (e.g. LAN scan + vendor API) is
 * implemented — not a stub. */
export interface AsicDiscoveryProvider {
  discover(): Promise<RawAsicInfo[]>;
}

export class NoopAsicDiscoveryProvider implements AsicDiscoveryProvider {
  async discover(): Promise<RawAsicInfo[]> {
    return [];
  }
}

/** Runs each category's discovery independently. A category's failure is caught,
 * reported in `failures`, and resolves to an empty result for that category — it
 * never aborts the other categories or rejects the overall discover() call
 * (§15 — never crash the platform because of a single hardware failure). */
export class SystemInformationDiscoveryProvider implements DiscoveryProvider {
  constructor(private readonly asicProvider: AsicDiscoveryProvider = new NoopAsicDiscoveryProvider()) {}

  async discover(): Promise<DiscoveryOutcome> {
    const failures: DiscoveryFailure[] = [];
    const report = (category: string, error: unknown) => {
      failures.push({ category, message: `${category} discovery failed: ${(error as Error).message}` });
    };

    const [cpu, gpu, asic, memory, storage, motherboard, network] = await Promise.all([
      this.safeCpu().catch((error) => {
        report('cpu', error);
        return [] as RawCpuInfo[];
      }),
      this.safeGpu().catch((error) => {
        report('gpu', error);
        return [] as RawGpuInfo[];
      }),
      this.safeAsic().catch((error) => {
        report('asic', error);
        return [] as RawAsicInfo[];
      }),
      this.safeMemory().catch((error) => {
        report('memory', error);
        return null as RawMemoryInfo | null;
      }),
      this.safeStorage().catch((error) => {
        report('storage', error);
        return [] as RawStorageDisk[];
      }),
      this.safeMotherboard().catch((error) => {
        report('motherboard', error);
        return null as RawMotherboardInfo | null;
      }),
      this.safeNetwork().catch((error) => {
        report('network', error);
        return [] as RawNetworkInterface[];
      }),
    ]);

    return {
      snapshot: { cpu, gpu, asic, memory, storage, motherboard, network, discoveredAt: new Date().toISOString() },
      failures,
    };
  }

  private async safeCpu(): Promise<RawCpuInfo[]> {
    const [info, currentSpeed, flags, load, temp] = await Promise.all([
      si.cpu(),
      si.cpuCurrentSpeed(),
      si.cpuFlags(),
      si.currentLoad(),
      si.cpuTemperature(),
    ]);
    return [
      {
        manufacturer: info.manufacturer,
        brand: info.brand,
        vendor: info.vendor,
        family: info.family,
        socket: (info as unknown as { socket?: string }).socket,
        physicalCores: info.physicalCores,
        cores: info.cores,
        cacheL1KB: (info as unknown as { cache?: { l1d?: number } }).cache?.l1d,
        cacheL2KB: (info as unknown as { cache?: { l2?: number } }).cache?.l2,
        cacheL3KB: (info as unknown as { cache?: { l3?: number } }).cache?.l3,
        flags: flags ? flags.split(' ').filter(Boolean) : [],
        virtualization: info.virtualization,
        currentLoadPercent: load?.currentLoad,
        speedMHz: currentSpeed?.avg ? currentSpeed.avg * 1000 : undefined,
        speedMinMHz: (info as unknown as { speedMin?: number }).speedMin
          ? (info as unknown as { speedMin?: number }).speedMin! * 1000
          : undefined,
        speedMaxMHz: info.speedMax ? info.speedMax * 1000 : undefined,
        temperatureCelsius: temp?.main ?? undefined,
      },
    ];
  }

  private async safeGpu(): Promise<RawGpuInfo[]> {
    const graphics = await si.graphics();
    return (graphics.controllers ?? []).map((controller) => ({
      vendor: controller.vendor,
      model: controller.model,
      vramMB: controller.vram ?? undefined,
      driverVersion: (controller as unknown as { driverVersion?: string }).driverVersion,
      bus: controller.bus,
      temperatureCelsius: (controller as unknown as { temperatureGpu?: number }).temperatureGpu,
      powerLimitWatts: (controller as unknown as { powerLimit?: number }).powerLimit,
      fanSupport: typeof (controller as unknown as { fanSpeed?: number }).fanSpeed === 'number',
    }));
  }

  private async safeAsic(): Promise<RawAsicInfo[]> {
    return this.asicProvider.discover();
  }

  private async safeMemory(): Promise<RawMemoryInfo> {
    const mem = await si.mem();
    return {
      totalMB: mem.total ? mem.total / 1024 / 1024 : undefined,
      freeMB: mem.available ? mem.available / 1024 / 1024 : undefined,
      ecc: undefined,
    };
  }

  private async safeStorage(): Promise<RawStorageDisk[]> {
    const layout = await si.diskLayout();
    const fsSize = await si.fsSize();
    return layout.map((disk) => {
      const matchingFs = fsSize.find((fs) => fs.fs?.includes(disk.device ?? '###no-match###'));
      return {
        type: disk.type,
        sizeMB: disk.size ? disk.size / 1024 / 1024 : undefined,
        availableMB: matchingFs?.available ? matchingFs.available / 1024 / 1024 : undefined,
        smartStatus: disk.smartStatus,
      };
    });
  }

  private async safeMotherboard(): Promise<RawMotherboardInfo> {
    const board = await si.baseboard();
    const bios = await si.bios();
    return {
      manufacturer: board.manufacturer,
      model: board.model,
      biosVersion: bios.version,
      chipset: (board as unknown as { chipset?: string }).chipset,
    };
  }

  private async safeNetwork(): Promise<RawNetworkInterface[]> {
    const interfaces = await si.networkInterfaces();
    const list = Array.isArray(interfaces) ? interfaces : [interfaces];
    return list.map((iface) => ({
      name: iface.iface,
      speedMbps: iface.speed ?? undefined,
      operstate: iface.operstate,
    }));
  }
}
