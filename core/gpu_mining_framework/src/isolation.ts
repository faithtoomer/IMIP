import { GpuIsolationError } from './errors.js';
/** Enforces explicit, exclusive session ownership by UUID; no GPU may be implicitly controlled. */
export class GpuIsolationGuard {
  private readonly claims = new Map<string, string>();
  claim(gpuUuid: string, sessionId: string): void { const owner = this.claims.get(gpuUuid); if (owner && owner !== sessionId) throw new GpuIsolationError(`GPU ${gpuUuid} is already exclusively claimed by session ${owner}.`); this.claims.set(gpuUuid, sessionId); }
  release(gpuUuid: string, sessionId: string): void { if (this.claims.get(gpuUuid) === sessionId) this.claims.delete(gpuUuid); }
  assertOwnership(gpuUuid: string, sessionId: string): void { if (this.claims.get(gpuUuid) !== sessionId) throw new GpuIsolationError(`Session ${sessionId} is not granted control of GPU ${gpuUuid}.`); }
  ownerOf(gpuUuid: string): string | undefined { return this.claims.get(gpuUuid); }
}
/** Validates any adapter/configuration-supplied device reference against the UUID grant. */
export function assertGpuScope(grantedGpuUuid: string, referencedGpuUuid: string): void { if (grantedGpuUuid !== referencedGpuUuid) throw new GpuIsolationError(`GPU scope violation: session granted ${grantedGpuUuid} cannot reference ${referencedGpuUuid}.`); }
