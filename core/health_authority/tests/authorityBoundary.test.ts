import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HealthAuthority } from '../src/HealthAuthority.js';
import { InjectableHardwareHealthProvider } from '../src/providers.js';
import { makeObservation } from './testHelpers.js';

const source = (name: string) => readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), 'utf8');

describe('IHIA authority boundaries', () => {
  it('consumes health evidence exclusively through injected providers', () => {
    const provider = new InjectableHardwareHealthProvider(() => [makeObservation({ componentId: 'injected-gpu' })]);
    const authority = new HealthAuthority({ providers: { hardware: provider }, now: () => '2026-08-08T12:00:00.000Z' });
    expect(authority.refresh().map((profile) => profile.componentId)).toEqual(['injected-gpu']);
  });

  it('does not import or instantiate hardware, resource, or workload authority classes directly', () => {
    const healthSource = [source('HealthAuthority.ts'), source('providers.ts'), source('digitalTwin.ts')].join('\n');
    expect(healthSource).not.toMatch(/from\s+['"][^'"]*(?:hardware_authority|resource_authority|workload_authority)[^'"]*['"]/);
    expect(healthSource).not.toMatch(/new\s+(?:HardwareAuthority|ResourceAuthority|WorkloadAuthority)\b/);
  });

  it('does not expose allocation, scheduling, mining, or runtime control methods', () => {
    const methods = Object.getOwnPropertyNames(HealthAuthority.prototype);
    expect(methods).not.toEqual(expect.arrayContaining(['allocate', 'reserve', 'schedule', 'mine', 'startRuntime', 'repair']));
  });
});
