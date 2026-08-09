import { CpuMiningSessionNotFoundError } from './errors.js';
import type { CpuMiningSession } from './types.js';
/** ICMF-owned session registry only; it is never a CPU-resource reservation ledger. */
export class CpuMiningSessionRegistry {
  private readonly sessions = new Map<string, CpuMiningSession>();
  add(session: CpuMiningSession): void { if (this.sessions.has(session.sessionId)) throw new Error(`CPU mining session ${session.sessionId} is already registered.`); this.sessions.set(session.sessionId, session); }
  get(sessionId: string): CpuMiningSession | undefined { return this.sessions.get(sessionId); }
  require(sessionId: string): CpuMiningSession { const session = this.get(sessionId); if (!session) throw new CpuMiningSessionNotFoundError(`CPU mining session ${sessionId} was not found.`); return session; }
  all(): CpuMiningSession[] { return [...this.sessions.values()]; }
}
