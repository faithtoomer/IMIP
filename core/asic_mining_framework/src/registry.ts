import { AsicMiningSessionNotFoundError } from './errors.js';
import type { AsicIsolationGuard } from './isolation.js';
import type { AsicMiningSession } from './types.js';
/** Session registry only; it delegates exclusivity to the isolation guard and never serves as a resource ledger. */
export class AsicMiningSessionRegistry {
  private readonly sessions = new Map<string, AsicMiningSession>();
  constructor(private readonly isolation: AsicIsolationGuard) {}
  add(session: AsicMiningSession): void { if (this.sessions.has(session.sessionId)) throw new Error(`ASIC mining session ${session.sessionId} is already registered.`); this.isolation.claim(session.config.asicUuid, session.sessionId); this.sessions.set(session.sessionId, session); }
  get(sessionId: string): AsicMiningSession | undefined { return this.sessions.get(sessionId); }
  require(sessionId: string): AsicMiningSession { const session = this.get(sessionId); if (!session) throw new AsicMiningSessionNotFoundError(`ASIC mining session ${sessionId} was not found.`); return session; }
  assertActiveOwnership(sessionId: string): AsicMiningSession { const session = this.require(sessionId); this.isolation.assertOwnership(session.config.asicUuid, sessionId); return session; }
  release(session: AsicMiningSession): void { this.isolation.release(session.config.asicUuid, session.sessionId); }
  all(): AsicMiningSession[] { return [...this.sessions.values()]; }
  byAsic(asicUuid: string): AsicMiningSession[] { return this.all().filter((session) => session.config.asicUuid === asicUuid); }
}
