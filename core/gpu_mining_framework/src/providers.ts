import type { GpuCertificationStatus, GpuPowerState, GpuResourceGrant, GpuResourceRequest, GpuThermalState } from './types.js';
/** IHIS-shaped read contract. IGMF neither discovers nor inventories GPUs. */
export interface GpuHardwareProvider { listGpus(): string[]; getGpu(gpuUuid: string): { gpuUuid: string; vendor: string; model: string; architecture: string; vramTotalMB: number; driverVersion: string; computeCapability: string; pcie: { bus?: string; generation?: string; lanes?: number }; health: 'healthy' | 'degraded' | 'faulted' | 'unknown'; healthReasons?: string[]; availableAlgorithms?: string[]; }; }
/** IRIA-shaped GPU reservation contract. It owns allocation/availability and is the only reservation source. */
export interface GpuResourceProvider { reserveVram(request: GpuResourceRequest): GpuResourceGrant; releaseVram(reservationId: string, reason: string): void; getAllocation(gpuUuid: string): { totalVramMB: number; usedVramMB: number; availableVramMB: number; allocatedComputeQueues: number; availableComputeQueues: number; contentionReasons?: string[]; }; }
/** ITIA-shaped read contract. No power/thermal policy mutation is exposed. */
export interface GpuThermalProvider { getThermalState(gpuUuid: string): GpuThermalState; }
/** IPIA-shaped read contract. */
export interface GpuPowerProvider { getPowerState(gpuUuid: string): GpuPowerState; }
/** IHCA-shaped read contract. */
export interface CertificationStatusProvider { getCertificationStatus(gpuUuid: string): GpuCertificationStatus; }
export interface GpuMiningProviders { hardware: GpuHardwareProvider; resource: GpuResourceProvider; thermal: GpuThermalProvider; power: GpuPowerProvider; certification: CertificationStatusProvider; }
