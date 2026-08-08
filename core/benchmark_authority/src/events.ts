import { EventEmitter } from 'node:events';
import type { EventDefinition, InstitutionalEventBus } from '../../event_bus/src/index.js';

export const BENCHMARK_EVENTS = {
  BenchmarkStarted: 'BenchmarkStarted',
  BenchmarkCompleted: 'BenchmarkCompleted',
  BenchmarkFailed: 'BenchmarkFailed',
  BenchmarkVerified: 'BenchmarkVerified',
  BenchmarkCompared: 'BenchmarkCompared',
  BenchmarkRegressionDetected: 'BenchmarkRegressionDetected',
  BenchmarkRecommendationGenerated: 'BenchmarkRecommendationGenerated',
} as const;

export type BenchmarkEventName = (typeof BENCHMARK_EVENTS)[keyof typeof BENCHMARK_EVENTS];
const PUBLISHER_AUTHORITY = 'Benchmark Authority';

export const BENCHMARK_EVENT_DEFINITIONS: EventDefinition[] = Object.values(BENCHMARK_EVENTS).map((name) => ({
  id: `benchmark.${name}`,
  name,
  category: 'benchmark',
  description: `IBIA event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: name === BENCHMARK_EVENTS.BenchmarkFailed || name === BENCHMARK_EVENTS.BenchmarkRegressionDetected ? 'high' : 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));

/** Local delivery and optional best-effort Event Bus mirroring, matching other authority event surfaces. */
export class BenchmarkEventBus {
  private emitter = new EventEmitter();
  private lastMirrorPromise: Promise<unknown> = Promise.resolve();

  constructor(private readonly institutionalEventBus?: InstitutionalEventBus) {
    if (institutionalEventBus) {
      for (const definition of BENCHMARK_EVENT_DEFINITIONS) {
        if (!institutionalEventBus.getEventDefinition(definition.name)) institutionalEventBus.registerEventType(definition);
      }
    }
  }

  publish(event: BenchmarkEventName, payload: unknown): void {
    this.emitter.emit(event, payload);
    if (this.institutionalEventBus) {
      this.lastMirrorPromise = this.institutionalEventBus.publish(event, PUBLISHER_AUTHORITY, payload).catch(() => {
        // Event mirroring does not interrupt institutional benchmark evidence.
      });
    }
  }

  subscribe(event: BenchmarkEventName, handler: (payload: unknown) => void): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }

  async flushMirror(): Promise<void> {
    await this.lastMirrorPromise;
  }
}
