import type { CapabilityNegotiationResult, NormalizedError } from './types.js';

export interface CapabilityNegotiationExplanation { adapterId: string; accepted: boolean; supported: string[]; rejected: string[]; rationale: string; }
export interface ErrorNormalizationExplanation { category: string; message: string; retriable: boolean; source?: string; rationale: string; }

export function explainCapabilityNegotiation(result: CapabilityNegotiationResult): CapabilityNegotiationExplanation {
  const supported = result.checks.filter((check) => check.supported).map((check) => check.reason);
  const rejected = result.checks.filter((check) => !check.supported).map((check) => check.reason);
  return { adapterId: result.adapterId, accepted: result.compatible, supported, rejected, rationale: result.compatible ? 'Every requested compatibility check passed.' : `${rejected.length} compatibility check(s) failed; the adapter cannot execute.` };
}
export function explainErrorNormalization(error: NormalizedError): ErrorNormalizationExplanation {
  return { category: error.category, message: error.message, retriable: error.retriable, source: error.source, rationale: `Classified as ${error.category}${error.code ? ` using code ${error.code}` : ''}; retriable=${error.retriable}.` };
}
