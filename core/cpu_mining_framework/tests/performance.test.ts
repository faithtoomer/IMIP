import { describe, expect, it } from 'vitest';
import { CpuPerformanceHistory } from '../src/performance.js';
import { normalized } from './testHelpers.js';
describe('ICMF performance intelligence', () => { it('tracks normalized CPU performance and derives per-thread/per-watt measures', () => { const history = new CpuPerformanceHistory(); const record = history.record('s', normalized(), { threadCount: 4, recordedAt: '2026-01-01T00:00:00.000Z', powerConsumptionWatts: 80 }); expect(record).toMatchObject({ hashratePerThread: 100, hashratePerWatt: 5, acceptedShares: 10 }); expect(history.forSession('s')).toHaveLength(1); }); });
