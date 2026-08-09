import { describe, expect, it } from 'vitest';
import { recommendCpuOptimization } from '../src/optimizationTelemetry.js';
import { composeCpuProfile } from '../src/cpuProfile.js';
import { FakeProviders } from './testHelpers.js';
describe('ICMF optimization telemetry', () => { it('produces advisory recommendations only and calls no provider mutation method', () => { const providers = new FakeProviders(); const recommendations = recommendCpuOptimization(composeCpuProfile(providers, 'cpu-1'), { reservationId: 'r', threadIds: [0, 1, 4, 5], coreIds: [0, 1, 2, 3], numaNodes: [0, 1], smtUsed: true, strategy: 'compact' }, { sessionId: 's', recordedAt: 'x', hashratePerWatt: 0, sourceStatistics: { extensions: {} } }); expect(recommendations.length).toBeGreaterThan(0); expect(recommendations.every((item) => item.advisory)).toBe(true); expect(providers.calls).toMatchObject({ reserve: 0, release: 0, mutation: 0 }); }); });
