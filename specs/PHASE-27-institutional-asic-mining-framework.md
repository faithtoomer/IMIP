# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM IV — MINING FRAMEWORK

## Phase 27

# Institutional ASIC Mining Framework (IAMF)

**Version:** 1.0  
**Status:** IMPLEMENTED  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Institutional Framework

> IAMF is the vendor-neutral, multi-ASIC execution layer above IMAF. It is not a Mining Authority, hardware authority, coin plugin, vendor SDK, or device communication implementation.

---

# 1. Mission Statement

The Institutional ASIC Mining Framework (IAMF) provides the standardized execution, monitoring, resource integration, and guarded lifecycle framework for ASIC-based cryptocurrency mining within IMIP. IAMF supports multiple ASIC vendors, devices, mining algorithms, communication mechanisms, and backend implementations without embedding coin-specific or vendor-specific logic in framework core.

---

# 2. Architectural Position

```text
Coin Plugin → ASIC Mining Framework → Mining Adapter Framework → ASIC Adapter → ASIC Miner / Device API → ASIC Hardware
```

A future coin plugin owns coin intelligence. An injected IMAF `MiningAdapter` owns local/network/vendor API, Stratum, device-management protocol, backend syntax, and backend lifecycle behavior. IAMF owns UUID-scoped session composition, deterministic capability evaluation, IRIA-requested resource consumption, normalized performance history, advisory recommendations, failure reporting, explainability, and ASIC Fleet Digital Twin evidence.

---

# 3. Mission Objectives

ASIC discovery integration; ASIC capability detection; algorithm compatibility; adapter-defined communication; work execution through adapters; mining lifecycle; hashrate monitoring; power, thermal, health, resource, and certification integration; multi-ASIC management; normalized failure reporting; and digital-twin evidence.

---

# 4. Institutional Principles

1. **Law 1 — Hardware Independence:** IAMF assumes no specific manufacturer. It contains no Bitmain, Whatsminer, Canaan, or real vendor SDK/protocol logic. Vendor coverage is parameterized fake-provider coverage only.
2. **Law 2 — Algorithm Independence:** Algorithms are opaque identifiers defined by registered generic `AsicAlgorithmProfile` capabilities. IAMF embeds no production algorithm; `test-asic-algorithm-fixture` is explicitly a test fixture only.
3. **Law 3 — Device Isolation:** ASIC UUID is first-class in profiles, reservations, grants, sessions, performance, and twin records. No ASIC is primary, and each UUID has at most one active session claim.
4. **Law 4 — Centralized Governance:** IRIA remains the sole owner of ASIC and hashboard availability, allocation, reservation, and release. IAMF pre-validates provider-reported availability before requesting a reservation and never self-grants or maintains a competing ledger.
5. **Law 5 — No Coin Logic:** Coin/pool intelligence belongs to Program V plugins. Pool/wallet/policy/network values are opaque references; raw wallet or pool credentials are rejected.
6. **Detection Reports; Authorities Govern:** IAMF publishes power, thermal, health-derived, and adapter-derived observations but does not restart, recover, throttle, reallocate, or override policy.
7. **Deterministic Read Logic:** Identical provider outputs, adapter declarations/statistics, configuration, and injected clock values yield deterministic profile composition, negotiation, resource pre-validation, secret-reference handling, performance records, and explanations.

---

# 5. Responsibilities and Non-Responsibilities

IAMF owns ASIC mining-session lifecycle/audit records; ASIC UUID identity registry read view; generic algorithm-capability registry; deterministic capability negotiation; device/hashboard resource pre-validation before an IRIA request; exclusive UUID isolation; normalized performance history; advisory optimization telemetry; failure-condition reports; ASIC-mining events; explainability; and append-only ASIC Fleet Digital Twin records.

IAMF does **not** own ASIC discovery or inventory, health monitoring, resource allocation/reservation source state, power/thermal state or policy, certification, secrets, mining authorization, workload selection, scheduling, adapter registry, protocol implementation, backend configuration translation, backend process implementation, coin logic, or an algorithm implementation.

---

# 6. Relationship to IHIS / IRIA / IPIA / ITIA / IHIA / IHCA / IMAF

**IHIS / Hardware Authority** owns ASIC discovery, UUID, manufacturer, model, firmware, hardware revision, capability, and network identity. IAMF receives an IHIS-shaped `AsicHardwareProvider` view, does not import IHIS implementation types/classes, and never creates or changes inventory records.

**IRIA / Resource Authority** owns `asic` and `asic-hashboard` availability, allocation, reservation, ownership, utilization, contention, and release. IAMF reads `AsicResourceProvider` allocation state, rejects insufficient device/hashboard requirements before `reserve()`, and accepts only IRIA's returned grant. Its session registry is never an allocation ledger.

**IPIA / Power Authority** owns ASIC power telemetry, limits, budgets, policy, and recommendations. IAMF reads `AsicPowerProvider`, derives efficiency, and publishes `AsicPowerWarning`; it shall not set a power limit or override policy.

**ITIA / Thermal Authority** owns ASIC temperature telemetry, thresholds, budgets, policy, and recommendations. IAMF reads `AsicThermalProvider` and publishes `AsicThermalWarning`; it shall not set a thermal limit or override policy.

**IHIA / Health Authority** owns cross-cutting device-health status, reliability, and health evidence. IAMF reads `AsicHealthProvider` as part of profile composition and failure reporting; it does not run an independent health monitor or alter health status.

**IHCA / Certification Authority** owns ASIC certification status and evidence. IAMF reads injected `CertificationStatusProvider` output and does not certify, revoke, or alter certification.

**IMAF / Mining Adapter Framework** owns the published adapter contract, backend registry, adapter lifecycle/audit, translation, normalization, error classification, and adapter readiness. IAMF accepts an already-selected `MiningAdapter` through dependency injection and invokes existing `identify`, `start`, `stop`, `statistics`, and `health` methods. Vendor-specific local/network APIs, vendor APIs, Stratum, and device-management protocols live entirely inside adapters.

These boundaries are crossed only through exported structural interfaces, Event Bus publication, and dependency injection. No source-authority implementation is imported, instantiated, or directly called.

---

# 7. ASIC Profile, Communication, and Resource Integration

Every ASIC exposes a composed ASIC Profile: ASIC UUID; Manufacturer; Model; Firmware; Hardware revision; algorithms; Hashrate capability; Power profile; Thermal profile; Network identity; Device health; Resource state; thermal state; power state; and Certification status.

`AsicProfileComposer` is read-through and defensive. Hardware identity/capability comes from `AsicHardwareProvider`; allocation/resource state comes from `AsicResourceProvider`; thermal state from `AsicThermalProvider`; power state from `AsicPowerProvider`; device health from `AsicHealthProvider`; and certification from `CertificationStatusProvider`. It stores no discovery, telemetry, allocation, health, or certification source of truth and has no cache.

`AsicResourceManagement` reads the composed IRIA state and requires matching ASIC UUID, a provider-available device, and every requested hashboard before calling `AsicResourceProvider.reserve()`. Passing pre-validation is not an allocation; only the returned IRIA grant authorizes execution. Release is returned to the same provider by grant ID.

IAMF contains zero protocol-specific communication code. The adapter boundary may implement local APIs, network APIs, vendor APIs, Stratum interfaces, or device-management protocols; IAMF sees only the established IMAF contract.

---

# 8. Multi-ASIC Architecture, Configuration, and Capability Negotiation

`AsicIdentityRegistry` lists and looks up known ASICs by UUID independently. It permits `ASIC-001`, `ASIC-002`, `ASIC-003`, and N further devices concurrently. Sorting is deterministic display only: it never means primary, default, or preferred device.

`AsicMiningConfig` carries UUID device selection plus required hashboards, opaque algorithm, pool endpoint/protocol and credential reference, opaque wallet reference, worker identity, performance/power/thermal policy references, network-configuration reference, explicit adapter device binding, and injected IMAF adapter reference. Raw wallet/pool credential fields are rejected; ISTA-style secret retrieval remains external to IAMF through opaque references.

Before resource reservation, deterministic ASIC negotiation evaluates Algorithm compatibility, Firmware compatibility, Adapter compatibility, Network accessibility, Power constraints, Thermal constraints, Resource availability, and Certification status. It supplies a stable ordered pass/fail decision with reasons. An incompatible ASIC does not request a reservation or start an adapter.

---

# 9. Device Isolation and Lifecycle

`AsicIsolationGuard` is integrated with the ASIC Mining Session Registry. A second concurrent claim on one ASIC UUID is rejected. `assertAsicScope()` rejects a configuration/device-selection/adapter binding that differs from the UUID grant. Stop or failure releases only that session's own claim; retained session history does not represent future ownership.

The phase calls this a “9-stage” lifecycle. Its explicit nominal sequence contains nine stages and is implemented exactly:

```text
Requested → Validated → Resource Reserved → Configured → Prepared → Started → Running → Monitored → Stopped
```

`Failed` is the explicit exception state reachable from active stages. `Monitored` may receive repeated observations. Configured/Prepared describe a UUID-scoped IRIA grant and injected adapter reference; IAMF does not recreate IMAF adapter configuration or preparation lifecycle.

---

# 10. Performance, Optimization, and Failure Handling

IAMF tracks normalized hashrate, accepted/rejected/invalid shares, hardware errors, uptime, power, temperature, derived hashrate-per-watt efficiency, pool latency, and the source normalized statistics. Division by zero is undefined rather than fabricated.

Optimization telemetry may recommend power-efficiency review, independently available device review, or algorithm-configuration review. Every recommendation has `advisory: true`; no provider mutation path exists and no power/thermal/resource/certification policy is applied.

IAMF detects Device disappearance, Communication failure, Firmware incompatibility, Hashboard failure, Thermal issues, Power issues, Miner failure, and Pool failure from provider views and adapter health/error signals. It preserves IMAF `NormalizedError` categories where supplied and creates IMAF-shaped normalized categories for detection-only evidence where appropriate. It never restarts a miner, recovers a device, changes a policy, or reallocates a resource.

---

# 11. Events, Explainability, and Digital Twin

IAMF publishes `AsicDiscovered`, `AsicValidated`, `AsicMiningStarted`, `AsicMiningStopped`, `AsicMiningFailed`, `AsicHashrateUpdated`, `AsicEfficiencyUpdated`, `AsicThermalWarning`, `AsicPowerWarning`, and `AsicDegraded` under additive Event Bus category `asic-mining`.

Explainability reports lifecycle stage/history, deterministic capability decisions, isolation rejection rationale, and detected failure conditions. It is descriptive and does not make an authorization or policy decision.

The append-only ASIC Fleet Digital Twin records the chain:

```text
ASIC → Algorithm → Firmware → Hashrate → Power → Thermal State → Health → Efficiency → Reliability
```

It is queryable by ASIC UUID, algorithm, and session. It is evidence for future fleet optimization and profitability intelligence, not a control plane or a replacement authority database. The additive Data Domains are `asic-mining-performance` and `asic-mining-digital-twin`.

---

# 12. Program IV Continuation and Deviation Note

Phase 27 extends Program IV with the ASIC framework after IMAF (Phase 24), ICMF (Phase 25), and IGMF (Phase 26). Program IV remains in progress for the planned process-manager, statistics, plugin-runtime, and plugin-certification phases; therefore Phase 26's prior “Program IV Completion” heading is not repeated as a completion claim here.

**Deviation note:** Vendor coverage uses Bitmain-, Whatsminer-, and Canaan-shaped fake hardware-provider profiles, not real vendor SDKs or network integrations. This is intentional: real vendor/protocol behavior belongs entirely inside injected adapters, preserving Laws 1 and 7.

---

# 13. Acceptance Criteria

Phase 27 is complete when ASIC mining has a standardized vendor-neutral framework; generic registered capabilities validate algorithms; multiple ASIC sessions operate concurrently on distinct UUIDs; duplicate and cross-device control are rejected; device/hashboard availability is pre-validated and IRIA-governed; power, thermal, health, and certification views are injected; statistics are normalized through IMAF output; all eight failure conditions and ten events are covered; the Fleet Digital Twin is queryable; raw credential fields are rejected; no prohibited authority import exists; Phase 24–27 registry rows are contiguous and formatted; documentation is complete; and tests pass without regression.
