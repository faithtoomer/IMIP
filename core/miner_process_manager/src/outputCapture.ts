import type { ObservabilitySink, SecurityPermissionProvider } from './providers.js';
import type { ProcessExitInfo } from './types.js';
export class ProcessOutputCapture {
 readonly captured: { stream: string; message: string }[] = [];
 constructor(private readonly sink: ObservabilitySink, private readonly security: SecurityPermissionProvider, private readonly now: () => string) {}
 emit(processUuid: string, stream: 'stdout' | 'stderr' | 'diagnostic' | 'exit', message: string, context?: Record<string, unknown>): void { const redacted = this.security.redact(message); this.captured.push({ stream, message: redacted }); this.sink.emit({ timestamp: this.now(), processUuid, stream, severity: stream === 'stderr' ? 'error' : stream === 'diagnostic' ? 'warning' : 'info', message: redacted, context }); }
 exit(processUuid: string, exit: ProcessExitInfo): void { this.emit(processUuid, 'exit', `Process exited with code ${exit.exitCode ?? 'null'} signal ${exit.signal ?? 'none'}.`, { exitCode: exit.exitCode, signal: exit.signal }); }
}
