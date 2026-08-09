import { AsicMiningValidationError } from './errors.js';
import type { AsicResourceProvider } from './providers.js';
import type { AsicProfile, AsicResourceGrant, AsicResourceRequest } from './types.js';
/** Validates the IRIA provider view before requesting a reservation; it never keeps an allocation ledger. */
export class AsicResourceManagement {
  constructor(private readonly resource: AsicResourceProvider) {}
  prevalidate(profile: AsicProfile, request: Pick<AsicResourceRequest, 'asicUuid' | 'requiredHashboardIds'>): { valid: boolean; reason?: string } {
    const required = [...new Set(request.requiredHashboardIds)].sort();
    if (request.asicUuid !== profile.asicUuid) return { valid: false, reason: `Resource request UUID ${request.asicUuid} does not match composed ASIC ${profile.asicUuid}.` };
    if (!profile.resourceState.deviceAvailable) return { valid: false, reason: `ASIC ${profile.asicUuid} is not currently available according to IRIA.` };
    if (!required.length) return { valid: false, reason: 'At least one ASIC hashboard resource must be requested.' };
    const missing = required.filter((id) => !profile.resourceState.availableHashboardIds.includes(id));
    return missing.length ? { valid: false, reason: `IRIA reports required hashboard resource(s) unavailable: ${missing.join(', ')}.` } : { valid: true };
  }
  reserve(profile: AsicProfile, request: AsicResourceRequest): AsicResourceGrant { const result = this.prevalidate(profile, request); if (!result.valid) throw new AsicMiningValidationError(result.reason!); return this.resource.reserve({ ...request, requiredHashboardIds: [...new Set(request.requiredHashboardIds)].sort() }); }
}
