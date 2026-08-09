import { AsicIsolationError } from './errors.js';
/** Enforces exclusive UUID ownership; no session may implicitly control another ASIC. */
export class AsicIsolationGuard {
  private readonly claims = new Map<string, string>();
  claim(asicUuid: string, sessionId: string): void { const owner = this.claims.get(asicUuid); if (owner && owner !== sessionId) throw new AsicIsolationError(`ASIC ${asicUuid} is already exclusively claimed by session ${owner}.`); this.claims.set(asicUuid, sessionId); }
  release(asicUuid: string, sessionId: string): void { if (this.claims.get(asicUuid) === sessionId) this.claims.delete(asicUuid); }
  assertOwnership(asicUuid: string, sessionId: string): void { if (this.claims.get(asicUuid) !== sessionId) throw new AsicIsolationError(`Session ${sessionId} is not granted control of ASIC ${asicUuid}.`); }
  ownerOf(asicUuid: string): string | undefined { return this.claims.get(asicUuid); }
}
/** Validates any configuration- or adapter-binding device reference against the UUID grant. */
export function assertAsicScope(grantedAsicUuid: string, referencedAsicUuid: string): void { if (grantedAsicUuid !== referencedAsicUuid) throw new AsicIsolationError(`ASIC scope violation: session granted ${grantedAsicUuid} cannot reference ${referencedAsicUuid}.`); }
