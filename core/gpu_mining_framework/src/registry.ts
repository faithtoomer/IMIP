import { GpuMiningSessionNotFoundError } from './errors.js';
import type { GpuIsolationGuard } from './isolation.js';
import type { GpuMiningSession } from './types.js';
/** Session registry only. It coordinates the isolation guard but is never a VRAM/allocation ledger. */
export class GpuMiningSessionRegistry {
  private readonly sessions = new Map<string, GpuMiningSession>();
  constructor(private readonly isolation: GpuIsolationGuard) {}
  add(session: GpuMiningSession): void { if (this.sessions.has(session.sessionId)) throw new Error(`GPU mining session ${session.sessionId} is already registered.`); this.isolation.claim(session.config.gpuUuid, session.sessionId); this.sessions.set(session.sessionId, session); }
  get(sessionId: string): GpuMiningSession | undefined { return this.sessions.get(sessionId); }
  require(sessionId: string): GpuMiningSession { const session = this.get(sessionId); if (!session) throw new GpuMiningSessionNotFoundError(`GPU mining session ${sessionId} was not found.`); return session; }
  assertActiveOwnership(sessionId: string): GpuMiningSession { const session = this.require(sessionId); this.isolation.assertOwnership(session.config.gpuUuid, sessionId); return session; }
  release(session: GpuMiningSession): void { this.isolation.release(session.config.gpuUuid, session.sessionId); }
  all(): GpuMiningSession[] { return [...this.sessions.values()]; }
  byGpu(gpuUuid: string): GpuMiningSession[] { return this.all().filter((session) => session.config.gpuUuid === gpuUuid); }
}
