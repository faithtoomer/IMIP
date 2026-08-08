import { ArbitrationNotFoundError } from './errors.js';
import type { ArbitrationRecord } from './types.js';
/** IRAA's registry owns arbitration evidence only; it is not a Resource Registry. */
export class ArbitrationRegistry {
  private records = new Map<string, ArbitrationRecord>();
  upsert(record: ArbitrationRecord): void { this.records.set(record.arbitrationId, freezeRecord(record)); }
  get(arbitrationId: string): ArbitrationRecord | undefined { return this.records.get(arbitrationId); }
  remove(arbitrationId: string): boolean { return this.records.delete(arbitrationId); }
  require(arbitrationId: string): ArbitrationRecord { const record = this.get(arbitrationId); if (!record) throw new ArbitrationNotFoundError(`arbitration ${arbitrationId}`); return record; }
  all(): ArbitrationRecord[] { return [...this.records.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.arbitrationId.localeCompare(b.arbitrationId)); }
  forResource(resourceId: string): ArbitrationRecord[] { return this.all().filter((record) => record.contestedResource === resourceId); }
}
function freezeRecord(record: ArbitrationRecord): ArbitrationRecord {
  return Object.freeze({ ...record, competingRequests: Object.freeze(record.competingRequests.map((request) => Object.freeze({ ...request, capabilityRefs: request.capabilityRefs ? Object.freeze([...request.capabilityRefs]) : undefined }))), deferredRequests: Object.freeze(record.deferredRequests.map((request) => Object.freeze({ ...request }))), policiesApplied: Object.freeze([...record.policiesApplied]), explainabilityRecord: record.explainabilityRecord ? Object.freeze({ ...record.explainabilityRecord, competingRequests: Object.freeze([...record.explainabilityRecord.competingRequests]), scores: Object.freeze([...record.explainabilityRecord.scores]), policies: Object.freeze([...record.explainabilityRecord.policies]), constraints: Object.freeze([...record.explainabilityRecord.constraints]) }) : undefined, decision: record.decision ? Object.freeze({ ...record.decision }) : undefined }) as ArbitrationRecord;
}
