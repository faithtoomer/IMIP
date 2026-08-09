import { GpuMiningValidationError } from './errors.js';
import type { GpuResourceProvider } from './providers.js';
import type { GpuProfile, GpuResourceGrant, GpuResourceRequest } from './types.js';
/** Validates provider-read availability before requesting IRIA reservation; it never maintains an allocation ledger. */
export class VramManagement {
  constructor(private readonly resource: GpuResourceProvider) {}
  prevalidate(profile: GpuProfile, requiredVramMB: number): { valid: boolean; reason?: string } { if (!Number.isFinite(requiredVramMB) || requiredVramMB <= 0) return { valid: false, reason: 'Required VRAM must be a positive finite value.' }; return requiredVramMB <= profile.vramAvailableMB ? { valid: true } : { valid: false, reason: `Workload requires ${requiredVramMB} MB VRAM but only ${profile.vramAvailableMB} MB is available from IRIA.` }; }
  reserve(profile: GpuProfile, request: GpuResourceRequest): GpuResourceGrant { const result = this.prevalidate(profile, request.requiredVramMB); if (!result.valid) throw new GpuMiningValidationError(result.reason!); return this.resource.reserveVram(request); }
}
