import type { AsicMiningProviders } from './providers.js';
import type { AsicProfile } from './types.js';
/** Read-through source composition only: intentionally no cache, discovery store, or independent state. */
export class AsicProfileComposer {
  constructor(private readonly providers: AsicMiningProviders) {}
  compose(asicUuid: string): AsicProfile {
    const hardware = this.providers.hardware.getAsic(asicUuid); const resource = this.providers.resource.getAllocation(asicUuid); const thermal = this.providers.thermal.getThermalState(asicUuid); const power = this.providers.power.getPowerState(asicUuid); const health = this.providers.health.getDeviceHealth(asicUuid); const certification = this.providers.certification.getCertificationStatus(asicUuid);
    return Object.freeze({ asicUuid: hardware.asicUuid, manufacturer: hardware.manufacturer, model: hardware.model, firmware: hardware.firmware, hardwareRevision: hardware.hardwareRevision, algorithms: [...hardware.algorithms].sort(), hashrateCapabilityHps: hardware.hashrateCapabilityHps, powerProfile: { ...hardware.powerProfile }, thermalProfile: { ...hardware.thermalProfile }, networkIdentity: { ...hardware.networkIdentity }, deviceHealth: { ...health, reasons: [...health.reasons].sort() }, resourceState: { ...resource, availableHashboardIds: [...resource.availableHashboardIds].sort(), allocatedHashboardIds: [...resource.allocatedHashboardIds].sort(), contentionReasons: [...resource.contentionReasons].sort() }, thermalState: { ...thermal }, powerState: { ...power }, certificationStatus: { ...certification } });
  }
}
export function composeAsicProfile(providers: AsicMiningProviders, asicUuid: string): AsicProfile { return new AsicProfileComposer(providers).compose(asicUuid); }
