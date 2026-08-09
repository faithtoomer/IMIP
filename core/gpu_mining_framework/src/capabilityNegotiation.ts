import type { GpuCapabilityNegotiationRequest, GpuCapabilityNegotiationResult } from './types.js';
function versionAtLeast(actual: string, minimum?: string): boolean { if (!minimum) return true; const a = actual.split(/[^0-9]+/).filter(Boolean).map(Number); const b = minimum.split(/[^0-9]+/).filter(Boolean).map(Number); for (let i = 0; i < Math.max(a.length, b.length); i++) { if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0); } return true; }
/** Pure deterministic compatibility evaluator over provider views and adapter declaration. */
export function negotiateGpuCapability(request: GpuCapabilityNegotiationRequest): GpuCapabilityNegotiationResult {
  const { profile, config, manifest } = request; const vendor = profile.vendor.toLowerCase(); const architecture = profile.architecture.toLowerCase();
  const checks = [
    { subject: 'vendor' as const, passed: !request.supportedVendors?.length || request.supportedVendors.map((v) => v.toLowerCase()).includes(vendor), rationale: `GPU vendor ${profile.vendor} checked against supplied compatibility list.` },
    { subject: 'architecture' as const, passed: !request.supportedArchitectures?.length || request.supportedArchitectures.map((v) => v.toLowerCase()).includes(architecture), rationale: `GPU architecture ${profile.architecture} checked against supplied compatibility list.` },
    { subject: 'driver' as const, passed: versionAtLeast(profile.driverVersion, request.minimumDriverVersion), rationale: `Driver ${profile.driverVersion} checked against minimum ${request.minimumDriverVersion ?? 'unspecified'}.` },
    { subject: 'vram' as const, passed: profile.vramAvailableMB >= request.requiredVramMB, rationale: `Available VRAM ${profile.vramAvailableMB} MB must satisfy ${request.requiredVramMB} MB.` },
    { subject: 'compute-capability' as const, passed: versionAtLeast(profile.computeCapability, request.minimumComputeCapability), rationale: `Compute capability ${profile.computeCapability} checked against minimum ${request.minimumComputeCapability ?? 'unspecified'}.` },
    { subject: 'algorithm' as const, passed: manifest.supportedAlgorithms.includes(config.algorithm), rationale: `Adapter manifest algorithm support checked for opaque identifier ${config.algorithm}.` },
    { subject: 'miner-support' as const, passed: manifest.supportedHardware.includes('gpu'), rationale: 'Injected adapter manifest must declare GPU support.' },
    { subject: 'resource-availability' as const, passed: profile.availableComputeQueues >= (request.requestedComputeQueues ?? 1), rationale: `Available compute queues ${profile.availableComputeQueues} checked against requested ${request.requestedComputeQueues ?? 1}.` },
    { subject: 'certification-status' as const, passed: !['denied', 'expired', 'revoked'].includes(profile.certificationStatus.status), rationale: `Certification status ${profile.certificationStatus.status} is eligible unless denied, expired, or revoked.` },
  ];
  const reasons = checks.filter((check) => !check.passed).map((check) => check.rationale); return { compatible: reasons.length === 0, checks, reasons };
}
