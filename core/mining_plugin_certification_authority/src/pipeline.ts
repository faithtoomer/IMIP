import type { PluginCertificationPipelineProviders } from './providers.js';
import type { PipelineProviderResult, PipelineStageResult, PluginCertificationPipelineStage, PluginCertificationProviderInput } from './types.js';

export const PIPELINE_STAGES: readonly PluginCertificationPipelineStage[] = [
  'StaticValidation', 'DependencyValidation', 'SecurityValidation', 'FunctionalTesting', 'CompatibilityTesting', 'PerformanceTesting', 'RuntimeTesting',
] as const;

export interface PipelineExecution { results: PipelineStageResult[]; providerResults: PipelineProviderResult[]; failedStage?: PluginCertificationPipelineStage; }

/** Invokes exactly one injected provider per stage and stops at the first failed provider result. */
export class PluginCertificationPipeline {
  constructor(private readonly providers: PluginCertificationPipelineProviders, private readonly createEvidenceId: () => string) {}

  async run(input: PluginCertificationProviderInput, onResult?: (result: PipelineStageResult) => void): Promise<PipelineExecution> {
    const invocations: Array<[PluginCertificationPipelineStage, () => PipelineProviderResult | Promise<PipelineProviderResult>]> = [
      ['StaticValidation', () => this.providers.staticValidation.validate(input)],
      ['DependencyValidation', () => this.providers.dependencyValidation.validate(input)],
      ['SecurityValidation', () => this.providers.securityValidation.validate(input)],
      ['FunctionalTesting', () => this.providers.functionalTesting.test(input)],
      ['CompatibilityTesting', () => this.providers.compatibilityTesting.test(input)],
      ['PerformanceTesting', () => this.providers.performanceTesting.test(input)],
      ['RuntimeTesting', () => this.providers.runtimeTesting.test(input)],
    ];
    const results: PipelineStageResult[] = [];
    const providerResults: PipelineProviderResult[] = [];
    for (const [stage, invoke] of invocations) {
      const output = await invoke();
      const evidenceReference = this.createEvidenceId();
      const result = { stage, passed: output.passed === true, evidenceReference, rationale: output.rationale, degraded: output.degraded === true };
      results.push(result);
      onResult?.(result);
      providerResults.push(output);
      if (output.passed !== true) return { results, providerResults, failedStage: stage };
    }
    return { results, providerResults };
  }
}
