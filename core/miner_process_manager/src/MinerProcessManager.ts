import { ProcessIdentityRegistry } from './identity.js';
import type { MinerProcessManagerDependencies } from './providers.js';
import { assertLifecycleTransition } from './lifecycle.js';
import { ProcessOutputCapture } from './outputCapture.js';
import { ResourceGate } from './resourceGate.js';
import { ProcessRegistry } from './registry.js';
import { DEFAULT_RESTART_POLICY, mayRestart } from './restart.js';
import { validateSecurity } from './security.js';
import { sweepOrphans } from './orphanDetection.js';
import { MinerProcessEventBus, MINER_PROCESS_EVENTS } from './events.js';
import { MinerProcessSupervisionGraph } from './supervisionGraph.js';
import { explainProcess, explainRejection, explainRestart } from './explainability.js';
import { ProcessLifecycleStage, type ManagedProcess, type OrphanSweepResult, type ProcessExitInfo, type ProcessFailureCondition, type ProcessLaunchRequest, type RestartKind } from './types.js';

/**
 * Sole owner of miner OS-process lifecycle. Its dependencies are injected structural
 * contracts; this class neither imports nor instantiates upstream authorities.
 */
export class MinerProcessManager {
 readonly identities = new ProcessIdentityRegistry();
 readonly registry = new ProcessRegistry(this.identities);
 readonly events = new MinerProcessEventBus();
 readonly graph = new MinerProcessSupervisionGraph();
 readonly output: ProcessOutputCapture;
 private readonly resourceGate: ResourceGate;
 private counter = 0;
 private readonly lastRestartAt = new Map<string, number>();
 constructor(private readonly dependencies: MinerProcessManagerDependencies) { this.resourceGate = new ResourceGate(dependencies.availability, dependencies.reservation, dependencies.resourcePermission); this.output = new ProcessOutputCapture(dependencies.observability, dependencies.security, dependencies.now); }

 async request(request: ProcessLaunchRequest): Promise<ManagedProcess> { const processUuid = this.dependencies.createUuid?.() ?? `miner-process-${++this.counter}`; const process = this.registry.add(processUuid, request); this.transition(process, ProcessLifecycleStage.Requested, 'Process launch requested.'); this.events.publish(MINER_PROCESS_EVENTS.MinerProcessRequested, { processUuid, stage: process.runtime.stage }); return process; }
 async launch(request: ProcessLaunchRequest): Promise<ManagedProcess> { const process = await this.request(request); return this.launchExisting(process, false); }
 private async launchExisting(process: ManagedProcess, restarted: boolean): Promise<ManagedProcess> {
  try {
   const environment = await validateSecurity(process.request, this.dependencies.security);
   this.transition(process, ProcessLifecycleStage.Validated, 'Security permission, executable, arguments, and environment validated.');
   const reservationIds = await this.resourceGate.pass(process.request, process.processUuid);
   process.runtime.reservationIds = reservationIds;
   this.transition(process, ProcessLifecycleStage.Prepared, 'Resource availability, reservation, and process permission accepted in order.');
   const result = await this.dependencies.launcher.spawn({ executable: process.request.executable, args: [...process.request.args], environment, secretReferences: { ...process.request.secretReferences }, processUuid: process.processUuid });
   process.runtime.pid = result.pid; process.runtime.startedAt = this.dependencies.now();
   if (!process.identity) process.identity = this.identities.assign({ processUuid: process.processUuid, parentWorkloadUuid: process.request.parentWorkloadUuid, adapterUuid: process.request.adapterUuid, pluginUuid: process.request.pluginUuid, pid: result.pid, startTime: process.runtime.startedAt, commandIdentity: { executable: this.dependencies.security.redact(process.request.executable), args: process.request.args.map((arg) => this.dependencies.security.redact(arg)) }, runtimeState: ProcessLifecycleStage.Spawned });
   this.transition(process, ProcessLifecycleStage.Spawned, `Process launcher returned PID ${result.pid}.`);
   this.events.publish(MINER_PROCESS_EVENTS.MinerProcessCreated, { processUuid: process.processUuid, stage: process.runtime.stage, pid: result.pid });
   result.onStdout?.((text) => this.output.emit(process.processUuid, 'stdout', text)); result.onStderr?.((text) => this.output.emit(process.processUuid, 'stderr', text)); result.onExit?.((code, signal) => { void this.recordExit(process.processUuid, process.request.callerId, { exitCode: code, signal, timestamp: this.dependencies.now() }); });
   this.transition(process, ProcessLifecycleStage.Starting, 'Startup diagnostics attached.'); this.events.publish(MINER_PROCESS_EVENTS.MinerProcessStarted, { processUuid: process.processUuid, stage: process.runtime.stage, pid: result.pid });
   this.transition(process, ProcessLifecycleStage.Running, 'Miner process is running.'); this.events.publish(MINER_PROCESS_EVENTS.MinerProcessReady, { processUuid: process.processUuid, stage: process.runtime.stage, pid: result.pid });
   this.graph.record({ pluginUuid: process.request.pluginUuid, workloadUuid: process.request.parentWorkloadUuid, adapterUuid: process.request.adapterUuid, processUuid: process.processUuid, resourceIds: process.request.resourceRequirements.map((x) => x.resourceId), hardwareIds: process.request.resourceRequirements.map((x) => x.hardwareId).filter((x): x is string => Boolean(x)) });
   if (restarted) this.events.publish(MINER_PROCESS_EVENTS.MinerProcessRestarted, { processUuid: process.processUuid, stage: process.runtime.stage, pid: result.pid });
   return process;
  } catch (caught) { const error = caught instanceof Error ? caught : new Error(String(caught)); this.fail(process, { type: error.message.toLowerCase().includes('resource') ? 'resource-unavailable' : error.message.toLowerCase().includes('permission') ? 'permission-denied' : error.message.toLowerCase().includes('spawn') ? 'spawn-failed' : 'security-validation', message: this.dependencies.security.redact(error.message), detectedAt: this.dependencies.now(), retriable: false }); throw error; }
 }
 private transition(process: ManagedProcess, to: ProcessLifecycleStage, reason: string): void { const from = process.runtime.stage as ProcessLifecycleStage | undefined; assertLifecycleTransition(process.lifecycle.length ? from : undefined, to); process.runtime.stage = to; process.lifecycle.push({ processUuid: process.processUuid, from: process.lifecycle.length ? from : undefined, to, at: this.dependencies.now(), reason: this.dependencies.security.redact(reason) }); }
 private fail(process: ManagedProcess, condition: ProcessFailureCondition): void { if (process.runtime.stage !== ProcessLifecycleStage.Failed && process.runtime.stage !== ProcessLifecycleStage.Archived) this.transition(process, ProcessLifecycleStage.Failed, condition.message); process.runtime.lastFailure = condition; this.output.emit(process.processUuid, 'diagnostic', condition.message, { type: condition.type }); this.events.publish(MINER_PROCESS_EVENTS.MinerProcessFailed, { processUuid: process.processUuid, stage: process.runtime.stage, reason: condition.message, pid: process.runtime.pid }); }
 async recordExit(processUuid: string, callerId: string, exit: ProcessExitInfo): Promise<ManagedProcess> { const process = this.control(processUuid, callerId); process.runtime.exitStatus = exit; this.output.exit(processUuid, exit); if (exit.exitCode === 0) { if (process.runtime.stage === ProcessLifecycleStage.Running || process.runtime.stage === ProcessLifecycleStage.Degraded) { this.transition(process, ProcessLifecycleStage.Stopping, 'Process exited cleanly.'); this.transition(process, ProcessLifecycleStage.Stopped, 'Process stopped after clean exit.'); this.events.publish(MINER_PROCESS_EVENTS.MinerProcessStopped, { processUuid, stage: process.runtime.stage }); } return process; } this.fail(process, { type: 'exit-nonzero', message: `Process exited unsuccessfully (${exit.exitCode ?? 'null'}).`, detectedAt: exit.timestamp, retriable: true }); return process; }
 async restart(processUuid: string, callerId: string, kind: RestartKind = 'manual'): Promise<ManagedProcess> { const process = this.control(processUuid, callerId); const policy = process.request.restartPolicy ?? DEFAULT_RESTART_POLICY; const result = mayRestart(policy, process.runtime.restartCount, kind, Date.parse(this.dependencies.now()), this.lastRestartAt.get(processUuid)); if (!result.allowed) { if (process.runtime.stage !== ProcessLifecycleStage.Degraded) this.transition(process, ProcessLifecycleStage.Degraded, result.reason ?? 'Restart rejected.'); process.runtime.lastFailure = { type: 'restart-exhausted', message: result.reason ?? 'Restart rejected.', detectedAt: this.dependencies.now(), retriable: false }; this.events.publish(MINER_PROCESS_EVENTS.MinerProcessDegraded, { processUuid, stage: process.runtime.stage, reason: result.reason }); return process; }
  if (process.runtime.pid !== undefined && (process.runtime.stage === ProcessLifecycleStage.Running || process.runtime.stage === ProcessLifecycleStage.Degraded)) { this.transition(process, ProcessLifecycleStage.Stopping, 'Restart requested.'); await this.dependencies.launcher.kill(process.runtime.pid, 'SIGTERM'); this.transition(process, ProcessLifecycleStage.Stopped, 'Process stopped for restart.'); }
  process.runtime.restartCount += 1; this.lastRestartAt.set(processUuid, Date.parse(this.dependencies.now())); return this.launchExisting(process, true);
 }
 async stop(processUuid: string, callerId: string): Promise<ManagedProcess> { const process = this.control(processUuid, callerId); if (process.runtime.stage === ProcessLifecycleStage.Running || process.runtime.stage === ProcessLifecycleStage.Degraded || process.runtime.stage === ProcessLifecycleStage.Failed) { this.transition(process, ProcessLifecycleStage.Stopping, 'Graceful stop requested.'); if (process.runtime.pid !== undefined) await this.dependencies.launcher.kill(process.runtime.pid, 'SIGTERM'); this.transition(process, ProcessLifecycleStage.Stopped, 'Process stopped.'); await this.dependencies.reservation.release?.(process.runtime.reservationIds, 'process stopped'); this.registry.release(process); this.events.publish(MINER_PROCESS_EVENTS.MinerProcessStopped, { processUuid, stage: process.runtime.stage }); } return process; }
 async terminate(processUuid: string, callerId: string): Promise<ManagedProcess> { const process = this.control(processUuid, callerId); if (process.runtime.stage === ProcessLifecycleStage.Running || process.runtime.stage === ProcessLifecycleStage.Degraded) { this.transition(process, ProcessLifecycleStage.Stopping, 'Forced termination requested.'); if (process.runtime.pid !== undefined) await this.dependencies.launcher.kill(process.runtime.pid, 'SIGKILL'); this.transition(process, ProcessLifecycleStage.Stopped, 'Process forcibly terminated.'); this.events.publish(MINER_PROCESS_EVENTS.MinerProcessStopped, { processUuid, stage: process.runtime.stage }); } await this.dependencies.reservation.release?.(process.runtime.reservationIds, 'process terminated'); this.registry.release(process); this.events.publish(MINER_PROCESS_EVENTS.MinerProcessTerminated, { processUuid, stage: process.runtime.stage }); return process; }
 async archive(processUuid: string, callerId: string): Promise<ManagedProcess> { const process = this.control(processUuid, callerId); this.transition(process, ProcessLifecycleStage.Archived, 'Process record archived.'); return process; }
 capture(processUuid: string, callerId: string, stream: 'stdout' | 'stderr' | 'diagnostic', text: string): void { this.control(processUuid, callerId); this.output.emit(processUuid, stream, text); }
 async sweep(cleanup = false): Promise<OrphanSweepResult> { return sweepOrphans(this.dependencies.launcher, this.registry.all(), cleanup); }
 explain(processUuid: string) { return explainProcess(this.registry.require(processUuid)); } explainRejection(error: Error) { return explainRejection(error); } explainRestart(processUuid: string, kind: RestartKind = 'automatic') { const p = this.registry.require(processUuid); const r = mayRestart(p.request.restartPolicy ?? DEFAULT_RESTART_POLICY, p.runtime.restartCount, kind, Date.parse(this.dependencies.now()), this.lastRestartAt.get(processUuid)); return explainRestart(r.allowed, r.reason, r.backoffMs); }
 private control(processUuid: string, callerId: string): ManagedProcess { this.identities.assertProcessScope(processUuid, callerId); return this.registry.require(processUuid); }
}
