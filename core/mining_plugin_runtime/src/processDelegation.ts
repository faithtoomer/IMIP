import type { ProcessManagerHandle } from './providers.js';
/** The sole process-start path in IMPR: delegate to injected IMPM-shaped handle; no child process is created here. */
export async function delegateProcessStart(handle: ProcessManagerHandle, request: unknown): Promise<unknown> { return handle.launch(request); }
