# Explainability Pipeline

**Status:** Binding Contract  
**Phase:** 01 (defined; not implemented)  
**Authority:** PHASE-01 §12 / `architecture/RUNTIME_ARCHITECTURE.md` §8

## Purpose

Every decision produced by the Decision Pipeline (`DECISION_PIPELINE.md`) shall generate an explainability record. These records form IMIP's permanent audit trail, owned by the Database Authority.

## Required Fields

| Field | Description |
|-------|--------------|
| Decision | The decision made |
| Reason | Why the decision was made |
| Evidence | Data supporting the decision |
| Supporting Metrics | Quantitative metrics behind the decision |
| Confidence | Confidence score for the decision |
| Alternative Options | Options that were considered |
| Rejected Alternatives | Options that were rejected, and why |
| Timestamp | When the decision was made |
| Responsible Authority | The authority that made or authorized the decision |
| Execution Duration | Time taken to produce the decision |

## Rules

1. Every stage of the Decision Pipeline contributes to the explainability record for that decision.
2. Explainability records are immutable once written.
3. The Database Authority owns storage and retention of explainability records; no other authority persists its own copy.
4. Explainability records are queryable by the Presentation Layer (dashboard/API) for audit purposes.

## Phase 01 Note

No explainability code is implemented in Phase 01. This document establishes the required record shape only.
