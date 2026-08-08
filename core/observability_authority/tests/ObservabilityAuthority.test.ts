import { describe, expect, it, afterEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { ObservabilityAuthority } from '../src/ObservabilityAuthority.js';
import { DataAuthority } from '../../data_authority/src/index.js';
import { StorageAuthority } from '../../storage_authority/src/index.js';
import { UnregisteredLogCategoryError, UnregisteredLogSchemaError, LogSchemaValidationError, CorrelationNotFoundError } from '../src/errors.js';
import { REDACTED } from '../src/security.js';
import { allow, makeTempRoot, cleanupTempRoot } from './testHelpers.js';

describe('ObservabilityAuthority (Law 1/Law 2 — the sole logging authority)', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('rejects logging under an unregistered category', () => {
    const iola = new ObservabilityAuthority();
    expect(() =>
      iola.log({ severity: 'information', category: 'not-a-category', authority: 'X', operation: 'op', message: 'x' }),
    ).toThrow(UnregisteredLogCategoryError);
  });

  it('rejects logging with no registered schema for the (category, operation) pair — Law 2', () => {
    const iola = new ObservabilityAuthority();
    expect(() =>
      iola.log({ severity: 'information', category: 'runtime', authority: 'X', operation: 'unregistered-op', message: 'x' }),
    ).toThrow(UnregisteredLogSchemaError);
  });

  it('enforces a schema\'s required context fields', () => {
    const iola = new ObservabilityAuthority();
    allow(iola, 'runtime', 'boot-started', ['bootId']);
    expect(() =>
      iola.log({ severity: 'information', category: 'runtime', authority: 'X', operation: 'boot-started', message: 'x', context: {} }),
    ).toThrow(LogSchemaValidationError);
    expect(() =>
      iola.log({
        severity: 'information',
        category: 'runtime',
        authority: 'X',
        operation: 'boot-started',
        message: 'x',
        context: { bootId: '1' },
      }),
    ).not.toThrow();
  });

  it('stamps logId/timestamp/version and always masks sensitive context', () => {
    const iola = new ObservabilityAuthority();
    allow(iola, 'security', 'credential-used');
    const record = iola.log({
      severity: 'information',
      category: 'security',
      authority: 'X',
      operation: 'credential-used',
      message: 'x',
      context: { apiKey: 'sk-real-value' },
    });
    expect(record.logId).toBeDefined();
    expect(record.timestamp).toBeDefined();
    expect(record.version).toBe('1.0.0');
    expect(record.context?.apiKey).toBe(REDACTED);
  });

  it('findByCorrelation() returns the ordered chain; throws for an unknown id', () => {
    const iola = new ObservabilityAuthority();
    allow(iola, 'runtime', 'step');
    const correlationId = iola.newCorrelationId();
    iola.log({ severity: 'information', category: 'runtime', authority: 'X', operation: 'step', message: 'first', correlationId });
    iola.log({ severity: 'information', category: 'runtime', authority: 'X', operation: 'step', message: 'second', correlationId });

    expect(iola.findByCorrelation(correlationId)).toHaveLength(2);
    expect(() => iola.findByCorrelation('nonexistent')).toThrow(CorrelationNotFoundError);
  });

  it('a severity="audit" log is captured in the structurally-immutable audit trail', () => {
    const iola = new ObservabilityAuthority();
    allow(iola, 'configuration', 'value-changed');
    iola.log({ severity: 'audit', category: 'configuration', authority: 'ICMS', operation: 'value-changed', message: 'x' });
    expect(iola.audit.all()).toHaveLength(1);
  });

  it('wires into a real DataAuthority: audit/error/warning/critical persist, information does not, by default', () => {
    const ida = new DataAuthority();
    const iola = new ObservabilityAuthority({ dataAuthority: ida });
    allow(iola, 'runtime', 'audited-op');
    allow(iola, 'runtime', 'info-op');

    const auditRecord = iola.log({ severity: 'audit', category: 'runtime', authority: 'X', operation: 'audited-op', message: 'x' });
    const infoRecord = iola.log({ severity: 'information', category: 'runtime', authority: 'X', operation: 'info-op', message: 'x' });

    expect(ida.get('runtime-logs', auditRecord.logId)).toBeDefined();
    expect(ida.get('runtime-logs', infoRecord.logId)).toBeUndefined();
    ida.close();
  });

  it('wires into a real StorageAuthority: FileLogSink writes real, day-rotated files under a real ISMA allocation', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    const iola = new ObservabilityAuthority({ storageAuthority: isma });
    allow(iola, 'runtime', 'op');

    iola.log({ severity: 'information', category: 'runtime', authority: 'X', operation: 'op', message: 'x' });

    const entry = isma.registry.findByPurpose('telemetry', 'iola-logs')!;
    expect(existsSync(entry.path)).toBe(true);
    expect(readdirSync(entry.path).length).toBeGreaterThan(0);
  });

  it('enforceRetention() delegates to a real StorageAuthority and returns undefined without one', () => {
    const bare = new ObservabilityAuthority();
    expect(bare.enforceRetention()).toBeUndefined();

    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    const iola = new ObservabilityAuthority({ storageAuthority: isma, logRetentionPolicy: { maxEntries: 0 } });
    allow(iola, 'runtime', 'op');
    iola.log({ severity: 'information', category: 'runtime', authority: 'X', operation: 'op', message: 'x' });

    const result = iola.enforceRetention();
    expect(result?.deletedFiles.length).toBeGreaterThan(0);
  });

  it('a broken sink does not throw out of log(), and reports through routingFailureCount', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const brokenSink = {
      name: 'broken',
      write() {
        throw new Error('boom');
      },
    };
    const iola = new ObservabilityAuthority({ sinks: [brokenSink] });
    allow(iola, 'runtime', 'op');
    expect(() => iola.log({ severity: 'information', category: 'runtime', authority: 'X', operation: 'op', message: 'x' })).not.toThrow();
    expect(iola.getMetrics().routingFailureCount).toBe(1);
    errorSpy.mockRestore();
  });

  it('getMetrics() tracks totals by severity', () => {
    const iola = new ObservabilityAuthority();
    allow(iola, 'runtime', 'op');
    iola.log({ severity: 'information', category: 'runtime', authority: 'X', operation: 'op', message: 'x' });
    iola.log({ severity: 'warning', category: 'runtime', authority: 'X', operation: 'op', message: 'x' });

    const metrics = iola.getMetrics();
    expect(metrics.totalLogged).toBe(2);
    expect(metrics.bySeverity.information).toBe(1);
    expect(metrics.bySeverity.warning).toBe(1);
  });
});
