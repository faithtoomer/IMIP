import { describe, expect, it, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConsoleLogSink, MemoryLogSink, FileLogSink, DatabaseLogSink, RUNTIME_LOG_SCHEMA } from '../src/sinks.js';
import { DataAuthority } from '../../data_authority/src/index.js';
import { makeTempRoot, cleanupTempRoot } from './testHelpers.js';
import type { StructuredLogRecord } from '../src/types.js';

function makeRecord(overrides: Partial<StructuredLogRecord> = {}): StructuredLogRecord {
  return {
    logId: 'log-1',
    timestamp: '2026-08-08T12:00:00.000Z',
    severity: 'information',
    category: 'runtime',
    authority: 'Test',
    operation: 'test-op',
    message: 'hello',
    version: '1.0.0',
    ...overrides,
  };
}

describe('Log sinks (§12)', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('ConsoleLogSink routes to console.error for error/critical, console.warn for warning, console.log otherwise', () => {
    const sink = new ConsoleLogSink();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    sink.write(makeRecord({ severity: 'critical' }));
    sink.write(makeRecord({ severity: 'warning' }));
    sink.write(makeRecord({ severity: 'information' }));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('MemoryLogSink is bounded', () => {
    const sink = new MemoryLogSink(2);
    sink.write(makeRecord({ logId: 'a' }));
    sink.write(makeRecord({ logId: 'b' }));
    sink.write(makeRecord({ logId: 'c' }));
    expect(sink.all().map((r) => r.logId)).toEqual(['b', 'c']);
  });

  it('FileLogSink writes real, date-rotated JSONL files', () => {
    root = makeTempRoot();
    const sink = new FileLogSink(root);
    sink.write(makeRecord({ timestamp: '2026-08-08T12:00:00.000Z' }));
    sink.write(makeRecord({ timestamp: '2026-08-09T00:00:00.000Z', logId: 'log-2' }));

    const day1 = join(root, 'logs-2026-08-08.jsonl');
    const day2 = join(root, 'logs-2026-08-09.jsonl');
    expect(existsSync(day1)).toBe(true);
    expect(existsSync(day2)).toBe(true);
    expect(JSON.parse(readFileSync(day1, 'utf-8').trim()).logId).toBe('log-1');
  });

  it('DatabaseLogSink persists a real record through IDA', () => {
    const ida = new DataAuthority();
    const sink = new DatabaseLogSink(ida);
    ida.registerDomainSchema(RUNTIME_LOG_SCHEMA);

    sink.write(makeRecord());

    const stored = ida.get('runtime-logs', 'log-1');
    expect(stored?.data.message).toBe('hello');
    ida.close();
  });
});
