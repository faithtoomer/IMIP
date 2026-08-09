import { AsicMiningValidationError } from './errors.js';
import type { AsicAlgorithmProfile } from './types.js';
/** TEST FIXTURE ONLY: invented opaque identifier, not a real or production algorithm. */
export const TEST_ASIC_ALGORITHM_PROFILE: AsicAlgorithmProfile = Object.freeze({ algorithmId: 'test-asic-algorithm-fixture', minimumFirmwareVersion: '1.0.0', requiredCapabilities: ['fixture-hashboard'], requiresNetworkAccess: true });
/** Registration is intentionally generic so plugin/composition code, rather than IAMF core, defines algorithms. */
export class AsicAlgorithmRegistry {
  private readonly profiles = new Map<string, AsicAlgorithmProfile>();
  register(profile: AsicAlgorithmProfile): void { if (!profile.algorithmId.trim()) throw new AsicMiningValidationError('Algorithm ID is required.'); this.profiles.set(profile.algorithmId, Object.freeze({ ...profile, requiredCapabilities: [...(profile.requiredCapabilities ?? [])].sort() })); }
  get(algorithmId: string): AsicAlgorithmProfile | undefined { return this.profiles.get(algorithmId); }
  require(algorithmId: string): AsicAlgorithmProfile { const profile = this.get(algorithmId); if (!profile) throw new AsicMiningValidationError(`ASIC algorithm ${algorithmId} is not registered.`); return profile; }
  list(): AsicAlgorithmProfile[] { return [...this.profiles.values()].sort((a, b) => a.algorithmId.localeCompare(b.algorithmId)); }
}
