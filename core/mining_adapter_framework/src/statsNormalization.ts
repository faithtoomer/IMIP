import type { NormalizedStatistics } from './types.js';

export type StatisticsNormalizer = (raw: unknown) => NormalizedStatistics;

export class StatisticsNormalizerRegistry {
  private readonly normalizers = new Map<string, StatisticsNormalizer>();
  register(adapterId: string, normalizer: StatisticsNormalizer): void { this.normalizers.set(adapterId, normalizer); }
  remove(adapterId: string): boolean { return this.normalizers.delete(adapterId); }
  normalize(adapterId: string, raw: unknown): NormalizedStatistics {
    const normalizer = this.normalizers.get(adapterId) ?? normalizeStructuralStatistics;
    return freezeStatistics(normalizer(raw));
  }
}

/** Conservative generic mapping for adapters that already emit institutional names. */
export function normalizeStructuralStatistics(raw: unknown): NormalizedStatistics {
  const source = raw !== null && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const number = (key: keyof NormalizedStatistics): number | undefined => typeof source[key] === 'number' && Number.isFinite(source[key]) ? source[key] as number : undefined;
  const workerStatus = typeof source.workerStatus === 'string' ? source.workerStatus : undefined;
  const known = new Set(['hashrateHps', 'acceptedShares', 'rejectedShares', 'errorRate', 'uptimeSeconds', 'poolLatencyMs', 'workerStatus', 'temperatureCelsius', 'powerWatts', 'efficiencyHpsPerWatt', 'extensions']);
  return { hashrateHps: number('hashrateHps'), acceptedShares: number('acceptedShares'), rejectedShares: number('rejectedShares'), errorRate: number('errorRate'), uptimeSeconds: number('uptimeSeconds'), poolLatencyMs: number('poolLatencyMs'), workerStatus, temperatureCelsius: number('temperatureCelsius'), powerWatts: number('powerWatts'), efficiencyHpsPerWatt: number('efficiencyHpsPerWatt'), extensions: { ...(source.extensions && typeof source.extensions === 'object' ? source.extensions as Record<string, unknown> : {}), ...Object.fromEntries(Object.entries(source).filter(([key]) => !known.has(key))) } };
}

function freezeStatistics(statistics: NormalizedStatistics): NormalizedStatistics { return Object.freeze({ ...statistics, extensions: Object.freeze({ ...statistics.extensions }) }); }
