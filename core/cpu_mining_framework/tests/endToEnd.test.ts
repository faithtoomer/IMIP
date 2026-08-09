import { describe, expect, it } from 'vitest';
import { CPU_MINING_NOMINAL_LIFECYCLE } from '../src/lifecycle.js';
import { running } from './testHelpers.js';
describe('ICMF end-to-end CPU session over injected IMAF-shaped adapter', () => { it('runs Requested through Stopped while using local fixture adapter only', async () => { const { framework, adapter, providers, session } = await running(); const result = await framework.monitor(session.sessionId); await framework.stop(session.sessionId); expect(framework.getLifecycle(session.sessionId).map((entry) => entry.to)).toEqual(CPU_MINING_NOMINAL_LIFECYCLE); expect(result.record.hashrateHps).toBe(400); expect(adapter).toMatchObject({ started: 1, stopped: 1 }); expect(providers.calls).toMatchObject({ reserve: 1, release: 1 }); }); });
