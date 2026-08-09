import type { CpuCertificationStatus, CpuNumaNode, CpuPowerState, CpuThermalState, CpuThreadAllocationRequest, CpuThreadGrant } from './types.js';

/** IHIS-shaped read contract. ICMF never imports or invokes HardwareAuthority. */
export interface CpuHardwareProvider { getCpu(cpuUuid: string): { cpuUuid: string; coreCount: number; threadCount: number; architecture: string; instructionSets: string[]; cache: { l1KB?: number; l2KB?: number; l3KB?: number }; numaTopology: CpuNumaNode[]; currentUtilizationPercent?: number; availableMemoryMB?: number; health: 'healthy' | 'degraded' | 'faulted' | 'unknown'; healthReasons?: string[]; }; }
/** IRIA-shaped reservation surface. ICMF requests/release grants but has no allocation ledger. */
export interface CpuResourceProvider { reserveThreads(request: CpuThreadAllocationRequest): CpuThreadGrant; releaseThreads(reservationId: string, reason: string): void; getAllocation(cpuUuid: string): { availableThreads: number; allocatedThreads: number; currentUtilizationPercent?: number; contentionReasons?: string[]; }; }
/** ITIA-shaped read contract; it is not power/thermal policy mutation. */
export interface CpuThermalProvider { getThermalState(cpuUuid: string): CpuThermalState; }
/** IPIA-shaped read contract; ICMF never modifies a power profile/budget. */
export interface CpuPowerProvider { getPowerState(cpuUuid: string): CpuPowerState; }
/** IHCA-shaped read contract. */
export interface CertificationStatusProvider { getCertificationStatus(cpuUuid: string): CpuCertificationStatus; }

export interface CpuMiningProviders { hardware: CpuHardwareProvider; resource: CpuResourceProvider; thermal: CpuThermalProvider; power: CpuPowerProvider; certification: CertificationStatusProvider; }
