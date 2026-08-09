import type { CpuMiningProviders } from './providers.js';
import type { CpuProfile } from './types.js';
/** Read-through composer: intentionally no cache or registry; source providers retain ownership. */
export class CpuProfileComposer {
  constructor(private readonly providers: CpuMiningProviders) {}
  compose(cpuUuid: string): CpuProfile {
    const hardware = this.providers.hardware.getCpu(cpuUuid);
    const allocation = this.providers.resource.getAllocation(cpuUuid);
    const thermal = this.providers.thermal.getThermalState(cpuUuid);
    const power = this.providers.power.getPowerState(cpuUuid);
    const certification = this.providers.certification.getCertificationStatus(cpuUuid);
    return Object.freeze({ cpuUuid: hardware.cpuUuid, coreCount: hardware.coreCount, threadCount: hardware.threadCount, architecture: hardware.architecture, instructionSets: [...hardware.instructionSets].sort(), cache: { ...hardware.cache }, numaTopology: hardware.numaTopology.map((node) => ({ ...node, threadIds: [...node.threadIds].sort((a, b) => a - b) })), availableThreads: allocation.availableThreads, allocatedThreads: allocation.allocatedThreads, currentUtilizationPercent: allocation.currentUtilizationPercent ?? hardware.currentUtilizationPercent, availableMemoryMB: hardware.availableMemoryMB, thermalState: { ...thermal }, powerState: { ...power }, certificationStatus: { ...certification }, hardwareHealth: hardware.health, hardwareHealthReasons: [...(hardware.healthReasons ?? [])].sort() });
  }
}
export function composeCpuProfile(providers: CpuMiningProviders, cpuUuid: string): CpuProfile { return new CpuProfileComposer(providers).compose(cpuUuid); }
