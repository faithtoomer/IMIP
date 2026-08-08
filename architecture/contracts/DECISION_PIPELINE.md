# Decision Pipeline

**Status:** Binding Contract  
**Phase:** 01 (defined; not implemented)  
**Authority:** PHASE-01 §11 / `architecture/RUNTIME_ARCHITECTURE.md` §7

## Purpose

Every mining decision in IMIP shall follow this exact sequence. This pipeline shall never be bypassed, shortened, or reordered by any authority, plugin, or AI integration.

## Pipeline

| # | Stage | Owning Authority |
|---|-------|-------------------|
| 1 | Hardware State | Hardware Authority |
| 2 | Capability Evaluation | Capability Registry Authority |
| 3 | Policy Evaluation | Policy Authority |
| 4 | Workload Evaluation | Workload Authority |
| 5 | Thermal Evaluation | Thermal Authority |
| 6 | Power Evaluation | Power Authority |
| 7 | Profitability Evaluation | Profitability Authority |
| 8 | Decision Intelligence | Decision Intelligence Authority |
| 9 | Authorization | Decision Intelligence Authority |
| 10 | Mining Authority | Mining Authority |
| 11 | Mining Adapter | Mining Adapter Layer |
| 12 | Mining Software | External Layer |
| 13 | Mining Pool | External Layer |

## Rules

1. Every stage executes in order; no stage may be skipped.
2. Each stage may only be reached from its predecessor.
3. AI (Machine Learning Authority, future) may inform stages 7–9 with predictions, rankings, or confidence scores — it may never execute a stage, authorize, or start/stop mining.
4. Every stage's outcome feeds the Explainability Pipeline (`EXPLAINABILITY_PIPELINE.md`).
5. A decision that fails any evaluation stage (Policy, Thermal, Power, Profitability, Workload) halts the pipeline before Authorization.

## Phase 01 Note

No decision execution code is implemented in Phase 01. This document establishes the pipeline contract only.
