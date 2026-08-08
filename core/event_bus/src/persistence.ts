import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import type { EventAuditRecord, EventEnvelope, EventHistoryFilter } from './types.js';

/**
 * §17 — configurable persistence. 'database' mode is achieved by supplying a
 * custom implementation of this interface once a Database Authority exists —
 * no concrete database-backed class ships here, since there is nothing to
 * connect to yet (same deferred-integration pattern as ADR-0008's ASIC
 * discovery / PCR read-surface). This interface is the extension point.
 */
export interface EventPersistence {
  record(envelope: EventEnvelope, audit: EventAuditRecord): void;
  history(filter?: EventHistoryFilter): EventEnvelope[];
  getAudit(eventId: string): EventAuditRecord | undefined;
}

/** Persistence mode 'none'. */
export class NoopEventPersistence implements EventPersistence {
  record(_envelope: EventEnvelope, _audit: EventAuditRecord): void {}
  history(_filter?: EventHistoryFilter): EventEnvelope[] {
    return [];
  }
  getAudit(_eventId: string): EventAuditRecord | undefined {
    return undefined;
  }
}

function matches(envelope: EventEnvelope, filter?: EventHistoryFilter): boolean {
  if (!filter) return true;
  if (filter.eventType && envelope.eventType !== filter.eventType) return false;
  if (filter.publisher && envelope.publisher !== filter.publisher) return false;
  if (filter.correlationId && envelope.correlationId !== filter.correlationId) return false;
  if (filter.since && envelope.timestamp < filter.since) return false;
  return true;
}

/** Persistence mode 'memory'. Bounded ring buffer — oldest entries drop once
 * maxSize is exceeded, so long-running processes don't leak memory. */
export class MemoryEventPersistence implements EventPersistence {
  private entries: { envelope: EventEnvelope; audit: EventAuditRecord }[] = [];

  constructor(private readonly maxSize = 10_000) {}

  record(envelope: EventEnvelope, audit: EventAuditRecord): void {
    this.entries.push({ envelope, audit });
    if (this.entries.length > this.maxSize) this.entries.shift();
  }

  history(filter?: EventHistoryFilter): EventEnvelope[] {
    const matched = this.entries.map((e) => e.envelope).filter((envelope) => matches(envelope, filter));
    return filter?.limit ? matched.slice(-filter.limit) : matched;
  }

  getAudit(eventId: string): EventAuditRecord | undefined {
    return this.entries.find((e) => e.envelope.eventId === eventId)?.audit;
  }
}

/** Persistence mode 'file'. Append-only JSONL, one line per {envelope, audit} pair.
 * history()/getAudit() read the file back on demand — real, but O(file size); fine
 * at this platform's expected event volume, documented as a scope choice. */
export class FileEventPersistence implements EventPersistence {
  constructor(private readonly filePath: string) {}

  record(envelope: EventEnvelope, audit: EventAuditRecord): void {
    appendFileSync(this.filePath, `${JSON.stringify({ envelope, audit })}\n`, 'utf-8');
  }

  private readAll(): { envelope: EventEnvelope; audit: EventAuditRecord }[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, 'utf-8').split('\n').filter(Boolean);
    return lines.map((line) => JSON.parse(line) as { envelope: EventEnvelope; audit: EventAuditRecord });
  }

  history(filter?: EventHistoryFilter): EventEnvelope[] {
    const matched = this.readAll()
      .map((e) => e.envelope)
      .filter((envelope) => matches(envelope, filter));
    return filter?.limit ? matched.slice(-filter.limit) : matched;
  }

  getAudit(eventId: string): EventAuditRecord | undefined {
    return this.readAll().find((e) => e.envelope.eventId === eventId)?.audit;
  }
}
