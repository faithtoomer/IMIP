import type { AsicCapabilityNegotiationRequest, AsicCapabilityNegotiationResult } from './types.js';
function versionAtLeast(actual: string, minimum?: string): boolean { if (!minimum) return true; const a = actual.split(/[^0-9]+/).filter(Boolean).map(Number); const b = minimum.split(/[^0-9]+/).filter(Boolean).map(Number); for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0); return true; }
/** Pure, deterministic compatibility evaluator over provider views, a generic algorithm definition, and adapter declaration. */
export function negotiateAsicCapability(request: AsicCapabilityNegotiationRequest): AsicCapabilityNegotiationResult {
  const { profile, config, manifest, algorithmProfile } = request; const requiredBoards = [...new Set(config.deviceSelection.requiredHashboardIds)].sort();
  const checks = [
    { subject: 'algorithm' as const, passed: profile.algorithms.includes(config.algorithm) && manifest.supportedAlgorithms.includes(config.algorithm), rationale: `Hardware and injected adapter declare support for opaque algorithm ${config.algorithm}.` },
    { subject: 'firmware' as const, passed: versionAtLeast(profile.firmware, algorithmProfile.minimumFirmwareVersion), rationale: `Firmware ${profile.firmware} checked against minimum ${algorithmProfile.minimumFirmwareVersion ?? 'unspecified'}.` },
    { subject: 'adapter' as const, passed: manifest.supportedHardware.includes('asic'), rationale: 'Injected adapter manifest must declare ASIC support.' },
    { subject: 'network' as const, passed: !algorithmProfile.requiresNetworkAccess || profile.networkIdentity.accessible, rationale: 'Provider-reported ASIC network accessibility checked for the algorithm capability.' },
    { subject: 'power' as const, passed: !profile.powerState.budgetExceeded && profile.powerState.state !== 'faulted', rationale: 'Power provider state must not report a budget breach or fault.' },
    { subject: 'thermal' as const, passed: !['warning', 'critical'].includes(profile.thermalState.state), rationale: 'Thermal provider state must be nominal or elevated for execution.' },
    { subject: 'resource' as const, passed: profile.resourceState.deviceAvailable && requiredBoards.length > 0 && requiredBoards.every((id) => profile.resourceState.availableHashboardIds.includes(id)), rationale: `IRIA availability checked for ASIC and hashboard resources: ${requiredBoards.join(', ') || 'none'}.` },
    { subject: 'certification' as const, passed: !['denied', 'expired', 'revoked'].includes(profile.certificationStatus.status), rationale: `Certification status ${profile.certificationStatus.status} is eligible unless denied, expired, or revoked.` },
  ];
  const reasons = checks.filter((check) => !check.passed).map((check) => check.rationale); return { compatible: reasons.length === 0, checks, reasons };
}
