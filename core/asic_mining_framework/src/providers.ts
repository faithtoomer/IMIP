import type { AsicCertificationStatus, AsicHealthState, AsicPowerState, AsicResourceGrant, AsicResourceRequest, AsicResourceState, AsicThermalState } from './types.js';
/** IHIS-shaped read contract. IAMF neither discovers nor inventories ASIC hardware. */
export interface AsicHardwareProvider { listAsics(): string[]; getAsic(asicUuid: string): { asicUuid: string; manufacturer: string; model: string; firmware: string; hardwareRevision: string; algorithms: string[]; hashrateCapabilityHps?: number; powerProfile: { maximumRatedWatts?: number; nominalWatts?: number }; thermalProfile: { warningThresholdCelsius?: number; criticalThresholdCelsius?: number }; networkIdentity: { address?: string; hostname?: string; accessible: boolean }; }; }
/** IRIA-shaped reservation surface. It is the sole owner of ASIC and hashboard allocation. */
export interface AsicResourceProvider { reserve(request: AsicResourceRequest): AsicResourceGrant; release(reservationId: string, reason: string): void; getAllocation(asicUuid: string): AsicResourceState; }
/** ITIA-shaped read contract; it exposes no thermal-policy mutation. */
export interface AsicThermalProvider { getThermalState(asicUuid: string): AsicThermalState; }
/** IPIA-shaped read contract; IAMF cannot modify power policy. */
export interface AsicPowerProvider { getPowerState(asicUuid: string): AsicPowerState; }
/** IHIA-shaped composed device-health contract; IAMF does not operate an independent health monitor. */
export interface AsicHealthProvider { getDeviceHealth(asicUuid: string): AsicHealthState; }
/** IHCA-shaped read contract. */
export interface CertificationStatusProvider { getCertificationStatus(asicUuid: string): AsicCertificationStatus; }
export interface AsicMiningProviders { hardware: AsicHardwareProvider; resource: AsicResourceProvider; thermal: AsicThermalProvider; power: AsicPowerProvider; health: AsicHealthProvider; certification: CertificationStatusProvider; }
