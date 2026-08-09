import { describe, expect, it, vi } from 'vitest';
import { makeAuthority, makeSubmission, fakeProviders, passingResult } from './testHelpers.js';

describe('IMPCA sequential evidence pipeline', () => {
  it('executes every injected stage in order and records immutable evidence on success', async () => {
    const order: string[]=[];
    const providers=fakeProviders({ staticValidation:{validate:()=>{order.push('static'); return passingResult();}}, dependencyValidation:{validate:()=>{order.push('dependency'); return passingResult();}}, securityValidation:{validate:()=>{order.push('security'); return passingResult();}}, functionalTesting:{test:()=>{order.push('functional'); return passingResult();}}, compatibilityTesting:{test:()=>{order.push('compatibility'); return passingResult();}}, performanceTesting:{test:()=>{order.push('performance'); return passingResult();}}, runtimeTesting:{test:()=>{order.push('runtime'); return passingResult();}} });
    const authority=makeAuthority({providers}); const submitted=authority.submit(makeSubmission()); const record=await authority.runPipeline(submitted.certificationId, makeSubmission().manifest);
    expect(order).toEqual(['static','dependency','security','functional','compatibility','performance','runtime']);
    expect(record.pipelineResults).toHaveLength(7); expect(record.evidenceReferences).toHaveLength(7); expect(record.lifecycleStage).toBe('EvidenceCollected');
  });

  it('short-circuits exactly on first failed stage and never treats later stages as passed', async () => {
    const later=vi.fn(() => passingResult());
    const authority=makeAuthority({providers:fakeProviders({ securityValidation:{validate:()=>passingResult({passed:false,rationale:'security finding'})}, functionalTesting:{test:later} })});
    const submitted=authority.submit(makeSubmission()); const record=await authority.runPipeline(submitted.certificationId, makeSubmission().manifest);
    expect(record.lifecycleStage).toBe('Failed'); expect(record.pipelineResults.map((result)=>result.stage)).toEqual(['StaticValidation','DependencyValidation','SecurityValidation']); expect(later).not.toHaveBeenCalled();
  });

  it('consults each provider rather than containing a placeholder pass path', async () => {
    const cases=[
      ['staticValidation', {validate:()=>passingResult({passed:false,rationale:'static failure'})}], ['dependencyValidation', {validate:()=>passingResult({passed:false,rationale:'dependency failure'})}], ['securityValidation', {validate:()=>passingResult({passed:false,rationale:'security failure'})}], ['functionalTesting', {test:()=>passingResult({passed:false,rationale:'functional failure'})}], ['compatibilityTesting', {test:()=>passingResult({passed:false,rationale:'compatibility failure'})}], ['performanceTesting', {test:()=>passingResult({passed:false,rationale:'performance failure'})}], ['runtimeTesting', {test:()=>passingResult({passed:false,rationale:'runtime failure'})}],
    ] as const;
    for (const [name, replacement] of cases) { const authority=makeAuthority({providers:fakeProviders({[name]:replacement} as never)}); const submitted=authority.submit(makeSubmission()); const record=await authority.runPipeline(submitted.certificationId, makeSubmission().manifest); expect(record.pipelineResults.at(-1)).toMatchObject({passed:false}); }
  });
});
