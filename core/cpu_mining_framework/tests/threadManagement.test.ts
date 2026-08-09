import { describe, expect, it } from 'vitest';
import { ThreadManagement } from '../src/threadManagement.js';
import { composeCpuProfile } from '../src/cpuProfile.js';
import { FakeProviders } from './testHelpers.js';
describe('ICMF thread management', () => { it('plans affinity/NUMA only from an existing IRIA grant and has no reservation side effect', () => { const providers = new FakeProviders(); const grant = providers.resource.reserveThreads({ cpuUuid: 'cpu-1', requestedThreads: 4 }); const before = providers.calls.reserve; const plan = new ThreadManagement().plan(composeCpuProfile(providers, 'cpu-1'), grant, { strategy: 'numa-local', preferredNumaNodes: [0] }); expect(plan.threadIds).toEqual(expect.arrayContaining(grant.grantedThreadIds)); expect(providers.calls.reserve).toBe(before); expect(typeof (new ThreadManagement() as unknown as { reserveThreads?: unknown }).reserveThreads).toBe('undefined'); }); });
