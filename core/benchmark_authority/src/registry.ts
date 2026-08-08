import { BenchmarkNotFoundError, BenchmarkValidationError } from './errors.js';
import type { BenchmarkRun, BenchmarkTypeDefinition } from './types.js';

/** Catalog is keyed by type/version; types remain category-driven and extensible. */
export class BenchmarkCatalog {
  private definitions = new Map<string, BenchmarkTypeDefinition>();

  static keyFor(typeId: string, version: string): string {
    return JSON.stringify([typeId, version]);
  }

  register(definition: BenchmarkTypeDefinition): void {
    validateDefinition(definition);
    this.definitions.set(BenchmarkCatalog.keyFor(definition.typeId, definition.version), freezeDefinition(definition));
  }

  get(typeId: string, version: string): BenchmarkTypeDefinition | undefined {
    return this.definitions.get(BenchmarkCatalog.keyFor(typeId, version));
  }

  require(typeId: string, version: string): BenchmarkTypeDefinition {
    const definition = this.get(typeId, version);
    if (!definition) throw new BenchmarkNotFoundError(`benchmark type ${BenchmarkCatalog.keyFor(typeId, version)}`);
    return definition;
  }

  remove(typeId: string, version: string): boolean {
    return this.definitions.delete(BenchmarkCatalog.keyFor(typeId, version));
  }

  all(): BenchmarkTypeDefinition[] {
    return [...this.definitions.values()].sort((a, b) => BenchmarkCatalog.keyFor(a.typeId, a.version)
      .localeCompare(BenchmarkCatalog.keyFor(b.typeId, b.version)));
  }

  byCategory(category: BenchmarkTypeDefinition['category']): BenchmarkTypeDefinition[] {
    return this.all().filter((definition) => definition.category === category);
  }
}

/** Lifecycle run index, keyed deterministically by UUID/type/component/version. It is not raw IHIS storage. */
export class BenchmarkRunRegistry {
  private runs = new Map<string, BenchmarkRun>();

  static keyFor(runId: string, typeId: string, component: string, version: string): string {
    return JSON.stringify([runId, typeId, component, version]);
  }

  upsert(run: BenchmarkRun): void {
    this.runs.set(BenchmarkRunRegistry.keyFor(run.runId, run.benchmarkTypeId, run.component, run.benchmarkVersion), freezeRun(run));
  }

  get(runId: string): BenchmarkRun | undefined {
    return [...this.runs.values()].find((run) => run.runId === runId);
  }

  require(runId: string): BenchmarkRun {
    const run = this.get(runId);
    if (!run) throw new BenchmarkNotFoundError(`benchmark run ${runId}`);
    return run;
  }

  all(): BenchmarkRun[] {
    return [...this.runs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.runId.localeCompare(b.runId));
  }

  historyFor(typeId: string, component: string, version: string): BenchmarkRun[] {
    return this.all().filter((run) => run.benchmarkTypeId === typeId && run.component === component && run.benchmarkVersion === version);
  }
}

function validateDefinition(definition: BenchmarkTypeDefinition): void {
  if (!definition.typeId.trim() || !definition.name.trim() || !definition.version.trim()) {
    throw new BenchmarkValidationError('Benchmark type id, name, and version are required.');
  }
  if (!definition.metric.trim() || !definition.unit.trim()) {
    throw new BenchmarkValidationError('Benchmark metric and unit are required.');
  }
  if (definition.componentKinds.length === 0 || definition.componentKinds.some((kind) => !kind.trim())) {
    throw new BenchmarkValidationError('At least one non-empty component kind is required.');
  }
}

function freezeDefinition(definition: BenchmarkTypeDefinition): BenchmarkTypeDefinition {
  return Object.freeze({ ...definition, componentKinds: Object.freeze([...definition.componentKinds]) }) as BenchmarkTypeDefinition;
}

function freezeRun(run: BenchmarkRun): BenchmarkRun {
  return Object.freeze({
    ...run,
    result: run.result ? Object.freeze({ ...run.result }) : undefined,
    environment: Object.freeze({ ...run.environment, configuration: run.environment.configuration ? { ...run.environment.configuration } : undefined, labels: run.environment.labels ? { ...run.environment.labels } : undefined }),
    hardwareProfile: Object.freeze({ ...run.hardwareProfile, configuration: run.hardwareProfile.configuration ? { ...run.hardwareProfile.configuration } : undefined }),
    powerProfile: Object.freeze({ ...run.powerProfile }),
    thermalProfile: Object.freeze({ ...run.thermalProfile }),
    verificationNotes: run.verificationNotes ? Object.freeze([...run.verificationNotes]) : undefined,
  }) as BenchmarkRun;
}
