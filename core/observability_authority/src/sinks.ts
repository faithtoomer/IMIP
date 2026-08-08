import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DataAuthority } from '../../data_authority/src/index.js';
import type { DomainSchema } from '../../data_authority/src/types.js';
import type { StructuredLogRecord } from './types.js';

export interface LogSink {
  readonly name: string;
  write(record: StructuredLogRecord): void;
}

/** §12 — the default, zero-config sink. */
export class ConsoleLogSink implements LogSink {
  readonly name = 'console';

  write(record: StructuredLogRecord): void {
    const line = `[${record.timestamp}] ${record.severity.toUpperCase()} ${record.category}/${record.authority} ${record.operation}: ${record.message}`;
    if (record.severity === 'error' || record.severity === 'critical') console.error(line);
    else if (record.severity === 'warning') console.warn(line);
    else console.log(line);
  }
}

/** Bounded in-memory sink — useful standalone (tests, short-lived
 * processes) without requiring a file or database destination. */
export class MemoryLogSink implements LogSink {
  readonly name = 'memory';
  private records: StructuredLogRecord[] = [];

  constructor(private readonly limit = 1000) {}

  write(record: StructuredLogRecord): void {
    this.records.push(record);
    if (this.records.length > this.limit) this.records.shift();
  }

  all(): readonly StructuredLogRecord[] {
    return this.records;
  }
}

/**
 * §12/§13 — writes into a managed directory (typically ISMA-allocated), one
 * JSONL file per UTC day. Rotating by day — rather than one continuously
 * growing file — is what makes §13's "retention execution integrates with
 * the Storage Authority" meaningful: ISMA's real retention enforcement
 * (Phase 09) ages out whole *files* in a directory by count/age; a single
 * ever-growing file would give it nothing to act on. See ADR-0013.
 */
export class FileLogSink implements LogSink {
  readonly name = 'file';

  constructor(private readonly directory: string) {}

  write(record: StructuredLogRecord): void {
    const datePart = record.timestamp.slice(0, 10); // YYYY-MM-DD
    const filePath = join(this.directory, `logs-${datePart}.jsonl`);
    appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf-8');
  }
}

export const RUNTIME_LOG_DOMAIN = 'runtime-logs';

/** §8 — deliberately permissive (`json`-typed) beyond the always-present
 * core fields: StructuredLogRecord carries many optional fields, and IOLA's
 * own schema registry (Law 2), not IDA's, is responsible for validating
 * which (category, operation) shapes are legal. */
export const RUNTIME_LOG_SCHEMA: DomainSchema = {
  domain: RUNTIME_LOG_DOMAIN,
  version: 1,
  fields: [
    { name: 'logId', type: 'string', required: true, unique: true },
    { name: 'timestamp', type: 'timestamp', required: true },
    { name: 'severity', type: 'string', required: true },
    { name: 'category', type: 'string', required: true },
    { name: 'authority', type: 'string', required: true },
    { name: 'operation', type: 'string', required: true },
    { name: 'message', type: 'string', required: true },
    { name: 'version', type: 'string', required: true },
    { name: 'component', type: 'string' },
    { name: 'eventId', type: 'string' },
    { name: 'correlationId', type: 'string' },
    { name: 'traceId', type: 'string' },
    { name: 'causationId', type: 'string' },
    { name: 'context', type: 'json' },
    { name: 'result', type: 'string' },
    { name: 'durationMs', type: 'number' },
    { name: 'exception', type: 'json' },
    { name: 'hostId', type: 'string' },
    { name: 'sessionId', type: 'string' },
  ],
};

/**
 * §12/§13 — routes into the Institutional Data Authority. IDA's own audit
 * trail (self-hosted, structurally immutable) records this write internally
 * without calling back into IOLA, so this path cannot recurse (§17).
 */
export class DatabaseLogSink implements LogSink {
  readonly name = 'database';

  constructor(private readonly dataAuthority: DataAuthority) {}

  write(record: StructuredLogRecord): void {
    this.dataAuthority.create(RUNTIME_LOG_DOMAIN, record as unknown as Record<string, unknown>, record.authority, {
      id: record.logId,
    });
  }
}
