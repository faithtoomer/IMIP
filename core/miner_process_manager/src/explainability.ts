import type { ManagedProcess } from './types.js';
export function explainProcess(process: ManagedProcess) { const latest = process.lifecycle.at(-1); return { processUuid: process.processUuid, stage: process.runtime.stage, lifecycle: [...process.lifecycle], restartCount: process.runtime.restartCount, rationale: latest ? `Process is ${latest.to}: ${latest.reason}` : 'No process lifecycle exists.' }; }
export function explainRejection(error: Error) { return { accepted: false, reason: error.message }; }
export function explainRestart(allowed: boolean, reason: string | undefined, backoffMs: number) { return { allowed, reason, backoffMs, rationale: allowed ? 'Restart is within the deterministic policy ceiling.' : reason ?? 'Restart is not permitted.' }; }
