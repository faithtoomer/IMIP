import { describe, expect, it } from 'vitest';
import { NullHardwareBenchmarkStore, withDefaultBenchmarkProviders } from '../src/providers.js';

describe('IBIA provider contracts', () => {
  it('uses a null structural IHIS store only when a composition root has not supplied an adapter', () => {
    const defaults = withDefaultBenchmarkProviders();
    expect(defaults.hardwareStore).toBeInstanceOf(NullHardwareBenchmarkStore);
    expect(defaults.hardwareStore.summarize('missing')).toEqual({ latestByWorkload: {}, bestByWorkload: {}, totalResults: 0 });
  });
});
