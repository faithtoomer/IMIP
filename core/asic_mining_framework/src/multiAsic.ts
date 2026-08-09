import type { AsicHardwareProvider } from './providers.js';
/** UUID-keyed ASIC identity view. Sorting is deterministic only; no member is primary. */
export class AsicIdentityRegistry {
  constructor(private readonly hardware: AsicHardwareProvider) {}
  list(): string[] { return [...new Set(this.hardware.listAsics())].sort(); }
  has(asicUuid: string): boolean { return this.list().includes(asicUuid); }
  lookup(asicUuid: string) { return this.has(asicUuid) ? this.hardware.getAsic(asicUuid) : undefined; }
  require(asicUuid: string) { const asic = this.lookup(asicUuid); if (!asic) throw new Error(`ASIC UUID ${asicUuid} is not known by the injected hardware provider.`); return asic; }
}
