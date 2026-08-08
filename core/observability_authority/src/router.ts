import type { LogSink } from './sinks.js';
import type { RoutingRule, StructuredLogRecord } from './types.js';

/** §12 — routing. Rules are evaluated in order, first match wins; no match
 * falls back to every configured sink. Each sink's write is isolated in its
 * own try/catch (one broken destination never blocks the others — the same
 * failure-isolation discipline the Event Bus applies to subscribers). */
export class LogRouter {
  constructor(
    private readonly sinks: LogSink[],
    private readonly rules: RoutingRule[],
  ) {}

  private sinksFor(record: StructuredLogRecord): LogSink[] {
    for (const rule of this.rules) {
      const categoryMatches = rule.category === undefined || rule.category === record.category;
      const severityMatches = rule.severity === undefined || rule.severity === record.severity;
      if (categoryMatches && severityMatches) {
        return this.sinks.filter((sink) => rule.sinks.includes(sink.name));
      }
    }
    return this.sinks;
  }

  /** Returns the number of sinks that failed. Failures are reported via
   * `onFailure`, never by throwing — a routing failure must not stop the
   * log call that triggered it (§17). */
  route(record: StructuredLogRecord, onFailure: (sinkName: string, error: Error) => void): number {
    let failures = 0;
    for (const sink of this.sinksFor(record)) {
      try {
        sink.write(record);
      } catch (error) {
        failures += 1;
        onFailure(sink.name, error as Error);
      }
    }
    return failures;
  }
}
