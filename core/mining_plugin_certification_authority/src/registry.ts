import { PluginCertificationNotFoundError } from './errors.js';
import type { PluginCertificationRecord } from './types.js';
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function frozen<T>(value: T): Readonly<T> { const snapshot=clone(value); const visit=(item: unknown): void => { if (item && typeof item === 'object' && !Object.isFrozen(item)) { Object.values(item as Record<string, unknown>).forEach(visit); Object.freeze(item); } }; visit(snapshot); return snapshot; }
/** IMPCA's authoritative certification-decision store, explicitly not the future platform Plugin Registry/ICR inventory. */
export class PluginCertificationRegistry {
  private readonly records = new Map<string, Readonly<PluginCertificationRecord>>();
  upsert(record: PluginCertificationRecord): Readonly<PluginCertificationRecord> { const snapshot=frozen(record); this.records.set(snapshot.certificationId, snapshot); return snapshot; }
  get(certificationId: string): Readonly<PluginCertificationRecord> | undefined { return this.records.get(certificationId); }
  require(certificationId: string): Readonly<PluginCertificationRecord> { const record=this.get(certificationId); if (!record) throw new PluginCertificationNotFoundError(certificationId); return record; }
  forPlugin(pluginUuid: string, version?: string): ReadonlyArray<Readonly<PluginCertificationRecord>> { return [...this.records.values()].filter((record) => record.pluginUuid === pluginUuid && (version === undefined || record.version === version)).sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.certificationId.localeCompare(right.certificationId)); }
  latest(pluginUuid: string, version: string): Readonly<PluginCertificationRecord> | undefined { return this.forPlugin(pluginUuid, version).at(-1); }
  all(): ReadonlyArray<Readonly<PluginCertificationRecord>> { return [...this.records.values()].sort((left,right) => left.certificationId.localeCompare(right.certificationId)); }
}
