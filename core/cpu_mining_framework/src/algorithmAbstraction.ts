import { CpuMiningValidationError } from './errors.js';
import type { AlgorithmCompatibilityCheck, AlgorithmCompatibilityResult, CpuAlgorithmProfile, CpuProfile } from './types.js';
/** TEST FIXTURE ONLY: invented identifier; not a real algorithm or production registration. */
export const TEST_ALGORITHM_PROFILE: CpuAlgorithmProfile = Object.freeze({ algorithmId: 'test-algo-fixture', requiredInstructionSets: ['fixture-simd'], memoryRequirements: { minimumMB: 256, recommendedMB: 512, perThreadMB: 32 }, threadCharacteristics: { minimumThreads: 1, maximumThreads: 16, prefersPhysicalCores: false, supportsSmt: true, numaAware: true } });
export class CpuAlgorithmRegistry {
  private readonly profiles = new Map<string, CpuAlgorithmProfile>();
  register(profile: CpuAlgorithmProfile): void { if (!profile.algorithmId.trim()) throw new CpuMiningValidationError('Algorithm ID is required.'); this.profiles.set(profile.algorithmId, freezeProfile(profile)); }
  get(algorithmId: string): CpuAlgorithmProfile | undefined { return this.profiles.get(algorithmId); }
  require(algorithmId: string): CpuAlgorithmProfile { const profile = this.get(algorithmId); if (!profile) throw new CpuMiningValidationError(`CPU algorithm ${algorithmId} is not registered.`); return profile; }
  list(): CpuAlgorithmProfile[] { return [...this.profiles.values()].sort((a, b) => a.algorithmId.localeCompare(b.algorithmId)); }
  compatibility(profile: CpuProfile, algorithm: CpuAlgorithmProfile, threads: number): AlgorithmCompatibilityResult {
    const instructionSets = new Set(profile.instructionSets.map((value) => value.toLowerCase())); const required = algorithm.requiredInstructionSets.map((value) => value.toLowerCase());
    const checks: AlgorithmCompatibilityCheck[] = [
      { subject: 'instruction-sets', passed: required.every((value) => instructionSets.has(value)), rationale: `Required instruction sets: ${required.join(', ') || 'none'}.` },
      { subject: 'memory', passed: profile.availableMemoryMB !== undefined && profile.availableMemoryMB >= algorithm.memoryRequirements.minimumMB + (algorithm.memoryRequirements.perThreadMB ?? 0) * threads, rationale: `Available memory ${profile.availableMemoryMB ?? 'unknown'} MB must satisfy algorithm memory requirements.` },
      { subject: 'threads', passed: threads >= algorithm.threadCharacteristics.minimumThreads && (algorithm.threadCharacteristics.maximumThreads === undefined || threads <= algorithm.threadCharacteristics.maximumThreads), rationale: `Requested ${threads} thread(s) checked against algorithm thread bounds.` },
      { subject: 'smt', passed: algorithm.threadCharacteristics.supportsSmt || threads <= profile.coreCount, rationale: algorithm.threadCharacteristics.supportsSmt ? 'Algorithm supports SMT.' : 'Algorithm requires no more threads than physical cores.' },
      { subject: 'numa', passed: !algorithm.threadCharacteristics.numaAware || profile.numaTopology.length > 0, rationale: algorithm.threadCharacteristics.numaAware ? 'Algorithm requires NUMA topology visibility.' : 'Algorithm has no NUMA visibility requirement.' },
    ];
    const reasons = checks.filter((check) => !check.passed).map((check) => check.rationale);
    return { algorithmId: algorithm.algorithmId, compatible: reasons.length === 0, checks, reasons };
  }
}
function freezeProfile(profile: CpuAlgorithmProfile): CpuAlgorithmProfile { return { ...profile, requiredInstructionSets: [...profile.requiredInstructionSets].sort(), memoryRequirements: { ...profile.memoryRequirements }, threadCharacteristics: { ...profile.threadCharacteristics } }; }
