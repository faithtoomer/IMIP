import type { GpuMiningProviders } from './providers.js';
import type { GpuProfile } from './types.js';
/** Read-through composition only: no cache and no duplicate discovery/allocation/telemetry state. */
export class GpuProfileComposer {
  constructor(private readonly providers: GpuMiningProviders) {}
  compose(gpuUuid: string): GpuProfile {
    const hardware = this.providers.hardware.getGpu(gpuUuid); const allocation = this.providers.resource.getAllocation(gpuUuid);
    const thermal = this.providers.thermal.getThermalState(gpuUuid); const power = this.providers.power.getPowerState(gpuUuid); const certification = this.providers.certification.getCertificationStatus(gpuUuid);
    return Object.freeze({ gpuUuid: hardware.gpuUuid, vendor: hardware.vendor, model: hardware.model, architecture: hardware.architecture, vramTotalMB: allocation.totalVramMB ?? hardware.vramTotalMB, vramUsedMB: allocation.usedVramMB, vramAvailableMB: allocation.availableVramMB, driverVersion: hardware.driverVersion, computeCapability: hardware.computeCapability, pcie: { ...hardware.pcie }, allocatedComputeQueues: allocation.allocatedComputeQueues, availableComputeQueues: allocation.availableComputeQueues, thermalState: { ...thermal }, powerState: { ...power }, certificationStatus: { ...certification }, health: hardware.health, healthReasons: [...(hardware.healthReasons ?? [])].sort() });
  }
}
export function composeGpuProfile(providers: GpuMiningProviders, gpuUuid: string): GpuProfile { return new GpuProfileComposer(providers).compose(gpuUuid); }
