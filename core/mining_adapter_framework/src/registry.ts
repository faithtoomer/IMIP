import type { MiningAdapter } from './adapterContract.js';
import { AdapterNotFoundError, AdapterRegistrationError } from './errors.js';
import type { AdapterCapabilities, AdapterHardwareKind, AdapterManifest } from './types.js';

export interface AdapterRegistryRecord {
  manifest: AdapterManifest;
  capabilities: AdapterCapabilities;
  adapter: MiningAdapter;
}

/** IMAF registry for supplied adapter contracts; it neither discovers plugins nor validates plugin manifests. */
export class MiningBackendRegistry {
  private readonly records = new Map<string, AdapterRegistryRecord>();

  register(record: AdapterRegistryRecord): void {
    if (!record.manifest.adapterId.trim()) throw new AdapterRegistrationError('Adapter manifest requires adapterId.');
    if (this.records.has(record.manifest.adapterId)) throw new AdapterRegistrationError(`Adapter ${record.manifest.adapterId} is already registered.`);
    this.records.set(record.manifest.adapterId, freezeRecord(record));
  }

  get(adapterId: string): AdapterRegistryRecord | undefined { return this.records.get(adapterId); }
  require(adapterId: string): AdapterRegistryRecord {
    const record = this.get(adapterId);
    if (!record) throw new AdapterNotFoundError(adapterId);
    return record;
  }
  remove(adapterId: string): boolean { return this.records.delete(adapterId); }
  all(): AdapterRegistryRecord[] { return [...this.records.values()].sort((a, b) => a.manifest.adapterId.localeCompare(b.manifest.adapterId)); }
  byAlgorithm(algorithm: string): AdapterRegistryRecord[] { return this.all().filter((record) => includes(record.capabilities.algorithms, algorithm)); }
  byOperatingSystem(operatingSystem: string): AdapterRegistryRecord[] { return this.all().filter((record) => includes(record.capabilities.operatingSystems, operatingSystem)); }
  byHardware(hardware: AdapterHardwareKind): AdapterRegistryRecord[] { return this.all().filter((record) => includes(record.capabilities.hardware, hardware)); }
  byProtocol(protocol: string): AdapterRegistryRecord[] { return this.all().filter((record) => includes(record.capabilities.protocols, protocol)); }
}

function includes(values: readonly string[], value: string): boolean { return values.some((candidate) => candidate.toLowerCase() === value.toLowerCase()); }
function sorted(values: readonly string[]): string[] { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }
function freezeRecord(record: AdapterRegistryRecord): AdapterRegistryRecord {
  return Object.freeze({
    adapter: record.adapter,
    manifest: Object.freeze({ ...record.manifest, supportedOperatingSystems: Object.freeze(sorted(record.manifest.supportedOperatingSystems)), supportedHardware: Object.freeze(sorted(record.manifest.supportedHardware)), supportedAlgorithms: Object.freeze(sorted(record.manifest.supportedAlgorithms)), supportedProtocols: Object.freeze(sorted(record.manifest.supportedProtocols)), requiredCapabilities: Object.freeze(sorted(record.manifest.requiredCapabilities)), supportedFeatures: Object.freeze(sorted(record.manifest.supportedFeatures)), configurationSchema: Object.freeze({ ...record.manifest.configurationSchema }) }),
    capabilities: Object.freeze({ operatingSystems: Object.freeze(sorted(record.capabilities.operatingSystems)), hardware: Object.freeze(sorted(record.capabilities.hardware)), algorithms: Object.freeze(sorted(record.capabilities.algorithms)), protocols: Object.freeze(sorted(record.capabilities.protocols)), statistics: Object.freeze(sorted(record.capabilities.statistics)), controlOperations: Object.freeze(sorted(record.capabilities.controlOperations)), features: Object.freeze(sorted(record.capabilities.features)) }),
  }) as AdapterRegistryRecord;
}
