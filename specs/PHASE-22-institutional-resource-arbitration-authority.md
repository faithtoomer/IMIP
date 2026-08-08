# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM III — RESOURCE INTELLIGENCE

## Phase 22

# Institutional Resource Arbitration Authority (IRAA)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Institutional Intelligence Authority

> IRAA is the implementation name for the “Resource Arbitration Authority” entry in `architecture/AUTHORITY_REGISTRY.md`.

---

# 1. Mission Statement

The Institutional Resource Arbitration Authority (IRAA) shall serve as the sole authority responsible for resolving resource contention, evaluating competing allocation requests, enforcing allocation policies, and producing deterministic, explainable arbitration decisions across IMIP. IRAA does **not** allocate resources directly. It decides which request should prevail when multiple valid requests compete for the same resource.

---

# 2. Mission Objectives

Resource contention detection; arbitration policies; priority resolution; fairness enforcement; starvation prevention; queue management; decision explainability; arbitration history; and future distributed arbitration.

---

# 3. Responsibilities

IRAA owns: Arbitration Registry; Contention Detection; Arbitration Policies; Priority Evaluation; Fairness Rules; Queue Management; Starvation Detection; Arbitration History; Arbitration Events; Explainability; and the Institutional Arbitration Knowledge Base (IAKB).

IRAA does **not** own: Resource Registry, Workload Scheduling, Mining Decisions, or Runtime Management. It consumes resource availability, health, thermal, power, and runtime evidence only through dependency-injected provider contracts. It imports and instantiates no other authority implementation class.

---

# 4. Relationship to IRIA (Phase 18)

IRIA remains the certified owner of the Resource Registry, resource identity, availability calculations, reservations, allocation execution, ownership/leasing, utilization, and capacity updates in `core/resource_authority/`. Its `ResourceAuthority.requestAllocation()` and internal `allocationEngine.allocate()` / `selectCandidate()` interfaces remain unchanged and are not invoked by IRAA.

IRAA is the decision layer alongside IRIA. It accepts IRAA-owned, structurally equivalent `ArbitrationRequest` inputs rather than importing IRIA's `AllocationRequest` type. When multiple requests target a resource, IRAA evaluates policies, constraints, fairness, and supplied health/thermal/power/runtime evidence; it emits one binding, explainable decision naming a winning request and remaining deferred or denied requests.

The caller—normally a future composition root or orchestration workflow—separately submits the winning request to IRIA after reading IRAA's decision. IRAA never calls `requestAllocation()`, `allocate()`, `reserve()`, `register()`, or any Resource Registry API. A `ResourceGranted` IRAA event means “selected for separate IRIA submission,” never that an allocation has occurred.

---

# 5. Arbitration Registry

Each record stores: Arbitration UUID, Timestamp, Contested Resource, Competing Requests, Winning Request, Deferred Requests, Policies Applied, Decision Score, Explainability Record, lifecycle stage, and failure reason when applicable. It is arbitration evidence, not a Resource Registry or allocation ledger.

---

# 6. Arbitration Inputs

IRAA evaluates provider-supplied resource availability, resource health, thermal constraints, power constraints, workload priority, runtime state, security-policy evidence when supplied through policy inputs, existing reservations, and historical fairness. Providers expose small structural interfaces; their source authorities retain ownership of raw state and measurement.

---

# 7. Arbitration Policies

The policy system is data-driven and pluggable through a `Policy` interface and `PolicyRegistry`. The required implementations are: First-Come-First-Served, Priority-Based, Fair-Share, Reservation-First, Exclusive-Access, Shared-Allocation, Emergency-Override, and Future-AI-Recommendations-Advisory-Only.

Policy evaluation precedes final priority ordering. Future AI evidence is recorded for explainability but has a zero score effect and cannot alter deterministic arbitration.

---

# 8. Determinism and Fairness

**Law 4 — Deterministic Arbitration:** identical requests, injected provider responses, policy registry, historical fairness state, and injected clock value produce identical decisions. There is no random or wall-clock tie-breaker. Equal aggregate scores are resolved lexicographically by stable `requestId`.

IRAA tracks first-seen time across cycles using an injected clock. It detects long-waiting requests, priority inversion, resource monopolization, and queue imbalance; it publishes `StarvationDetected` evidence when configured thresholds are crossed. Fair-Share adds a documented starvation-relief score after the threshold so waiting work cannot be indefinitely eclipsed by repeated grants.

---

# 9. Arbitration Lifecycle

Request Received → Contention Detected → Policy Evaluation → Constraint Evaluation → Winner Selected → Decision Published → History Archived.

Each transition is guarded and persisted in an append-only audit trail. A failed arbitration publishes `ArbitrationFailed` and retains the last reached lifecycle stage in the Arbitration Registry; failure is not an unapproved eighth lifecycle state.

---

# 10. Arbitration Events

IRAA publishes: ResourceContentionDetected, ArbitrationStarted, ArbitrationCompleted, ArbitrationFailed, ResourceGranted, ResourceDeferred, ResourceDenied, and StarvationDetected. All Phase 22 events use the institutional Event Bus `arbitration` category. Event mirroring is best-effort and does not turn IRAA into an allocator.

---

# 11. Explainability

Every arbitration answers the five Law-5 questions:

1. Which requests competed?
2. Which resource was contested?
3. Which policies were evaluated?
4. Why did one request win?
5. Why were the others deferred or denied?

The explanation also exposes scores, provider-derived constraints, decision rationale, and fairness evaluation. It explicitly distinguishes an arbitration choice from an IRIA allocation.

---

# 12. Architect's Enhancement: Institutional Arbitration Knowledge Base (IAKB)

IAKB records every arbitration outcome, fairness metric, policy used, and resource-contention pattern. It is queryable for recurring bottlenecks and informs future Decision Intelligence policy tuning or infrastructure-upgrade recommendations. IAKB is descriptive institutional history only; it does not change the deterministic process or acquire allocation ownership.

---

# 13. Acceptance Criteria

Phase 22 is complete only when: Arbitration Registry exists; contention detection functions; all named policy evaluation works; starvation prevention operates; events publish correctly; explainability is complete; IAKB is queryable; documentation is complete; and tests pass without regressions.
