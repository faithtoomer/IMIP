# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM IV — MINING FRAMEWORK

## Phase 24

# Institutional Mining Adapter Framework (IMAF)

**Version:** 1.0  
**Status:** IMPLEMENTED  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Institutional Framework

> IMAF is the Mining Adapter Layer named by `architecture/contracts/PLUGIN_DISCOVERY_ARCHITECTURE.md`. It is a framework, not the separate future Mining Authority in `architecture/AUTHORITY_REGISTRY.md`.

---

# 1. Mission Statement

The Institutional Mining Adapter Framework (IMAF) provides the standardized abstraction layer between IMIP and external mining software, mining protocols, algorithms, and execution backends. IMAF allows IMIP to operate different mining implementations through one institutional contract without embedding miner-specific logic throughout the platform. The framework supports future miners, algorithms, operating systems, and hardware without architectural redesign.

IMAF does **not** mine. It contains no coin-specific or algorithm-specific implementation and does not hard-code any real miner integration. A backend-specific implementation is an adapter supplied through the contract; the adapter is the boundary.

---

# 2. Architectural Position

```text
IMIP Authorities → Mining Framework → IMAF → {CPU Adapter, GPU Adapter, ASIC Adapter} → Miner Backend / External Miner
```

The framework owns adapter orchestration, registry metadata, normalized information, guarded adapter lifecycle, and explainability. An adapter owns its backend syntax and process behavior. A future Program V plugin may supply an adapter, but IMAF does not discover, validate, or register plugins.

---

# 3. Mission Objectives

Standard mining adapter contract; miner process abstraction; algorithm and pool abstraction; credential-reference handling; configuration translation; process lifecycle; statistics normalization; health reporting; error normalization; capability negotiation; compatibility validation; lightweight adapter certification; and explainability.

---

# 4. Institutional Principles

1. **Law 1 — One Adapter Contract:** Every backend implements `identify()`, `validate()`, `configure()`, `prepare()`, `start()`, `pause()`, `resume()`, `stop()`, `restart()`, `health()`, `statistics()`, `capabilities()`, `diagnostics()`, and `cleanup()`.
2. **Law 2 — Backend Independence:** IMAF assumes no named miner, executable, coin, protocol implementation, configuration syntax, or device vendor.
3. **Law 3 — No Coin Logic in Core:** Coin-specific and algorithm-specific behavior belongs to future Program V plugins and adapter implementations, never IMAF core.
4. **Law 4 — No Direct Process Control Outside the Framework:** External miner control is represented only through the adapter lifecycle contract; IMAF itself does not spawn an OS process in Phase 24.
5. **Law 5 — Normalized Intelligence:** Different backend statistic/error shapes are mapped to stable institutional shapes, with backend extras retained only as extension fields.
6. **Law 6 — Deterministic Decisions:** Capability negotiation and error classification produce the same result for the same inputs and registered functions. Backend process execution remains inherently external and non-deterministic.

---

# 5. Responsibilities and Non-Responsibilities

IMAF owns: the Mining Backend Registry; adapter-contract orchestration; an adapter lifecycle audit trail; capability negotiation; adapter-owned configuration translator lookup; statistics normalizer lookup; error classifier lookup; local adapter-certification records; adapter events; redaction before diagnostics leave the framework; and explainability of compatibility/error results.

IMAF does **not** own mining decisions, miner selection authorization, hardware discovery, hardware state, resource discovery/allocation/reservation, scheduling, workload selection, power/thermal/health monitoring, secret storage, plugin discovery, plugin manifest validation, capability-registry state, or real OS subprocess creation.

Dependencies cross the boundary only through the Event Bus, exported structural interfaces, and dependency injection. `core/mining_adapter_framework/src` imports no implementation class from a prohibited authority.

---

# 6. Relationship to IHIS / IRIA / ISTA / Future Mining Authority / Future Plugin Registry Authority

**IHIS / Hardware Authority** remains the owner of hardware discovery, identity, inventory, device capability reporting, and raw CPU/GPU/ASIC detail. IMAF neither discovers devices nor imports IHIS types. `CapabilityNegotiationRequest.hardware` is an authority-neutral structural shape (`kind`, optional identifiers/capabilities) that a composition root can adapt from IHIS output later.

**IRIA / Resource Authority** remains the owner of resource profiles, availability, reservation, allocation, ownership, and utilization. IMAF neither requests nor grants a resource. An adapter can be negotiated against a caller-provided hardware shape, but no successful IMAF negotiation represents an allocation.

**ISTA / Security Authority** remains the sole secret-storage and authorization owner. IMAF consumes only its structurally matching injected `SecretProvider` surface: `storeSecret`, `retrieveSecret`, and `rotateSecret`, each scoped by component ID. IMAF never imports or instantiates `SecurityAuthority`, never persists credentials, rejects raw credential-bearing institutional configuration, and redacts sensitive diagnostics/log output.

**Future Mining Authority** will own authorization, activation, and operational control of a mining operation. It may select a registered IMAF adapter, request compatibility evaluation, and invoke IMAF lifecycle methods through a composition root. IMAF cannot authorize mining, select a coin, schedule work, or activate a plugin on its own.

**Future Plugin Registry Authority and Capability Registry** will own plugin discovery, manifest validation, plugin registration, and platform capability registration. IMAF exposes plain exported `AdapterManifest`, `AdapterCapabilities`, `CapabilityNegotiationRequest`, and `CapabilityNegotiationResult` types for that future layer to consume. IMAF accepts an already-supplied adapter object; it does not scan, parse plugin manifests, validate a plugin package, or create files under `core/capability_registry/`.

---

# 7. Adapter Contract and Manifest

`MiningAdapter` is the universal adapter boundary. Its `AdapterManifest` declares Adapter ID, Name, Version, Vendor, Backend, Supported Operating Systems, Supported Hardware, Supported Algorithms, Supported Protocols, Required Capabilities, Supported Features, Configuration Schema, Minimum Framework Version, and adapter Certification Status.

The framework registry retains each explicitly registered adapter's manifest and declared capabilities by Adapter ID. It can query registered records by algorithm, OS, hardware, and pool protocol. Registry registration is not plugin discovery: the adapter is supplied deliberately by an external caller.

`MockCpuAdapter` and `MockGpuAdapter` are clearly marked TEST FIXTURES ONLY. They use invented test algorithms/protocols and do not run a miner, embody a real backend, or constitute production integrations.

---

# 8. Capability Negotiation and Compatibility Validation

Before lifecycle configuration, IMAF evaluates whether an adapter supports the requested operating system, hardware kind, algorithm identifier, pool protocol, required normalized statistics, required control operations, caller-provided required hardware capabilities, and minimum framework version.

The negotiation engine returns a deterministic pass/fail result with stable ordered checks and exact rejection reasons. A failed negotiation transitions the supplied adapter record to `Rejected` and publishes `AdapterRejected`; no backend lifecycle method is invoked. A compatible request is then passed to the adapter's own `validate()` method for backend-specific validation without importing its implementation details.

---

# 9. Configuration Translation, Process Abstraction, and Lifecycle

`MiningInstitutionalConfig` carries only institutional values and secret references. An adapter-owned pluggable `ConfigTranslator` produces opaque `BackendConfig`; no other IMIP component needs to know backend-native configuration syntax.

The process abstraction defines adapter-neutral executable location, arguments, environment, working directory, stdout/stderr handles, exit code, PID, runtime state, and resource usage. It is types/interfaces only in Phase 24. Process spawning remains an adapter implementation responsibility in a future approved phase.

The nominal lifecycle is:

```text
Discovered → Registered → Validated → Configured → Prepared → Started → Running → Stopping → Stopped → Retired
```

`Failed` and `Rejected` are explicit exception states reachable from multiple guarded pre-retirement stages. The nominal lifecycle has ten operational stages plus two explicit terminal exception states; this preserves every state expressly required by the Phase 24 lifecycle text rather than concealing failure/rejection outside the lifecycle. Restart/recovery are modeled as guarded returns through Started and Running. Pause/resume are adapter control operations rather than invented lifecycle states.

---

# 10. Statistics, Health, and Error Normalization

Adapters may expose arbitrary raw statistics. An optional per-adapter normalizer maps them to `NormalizedStatistics`: Hashrate, Accepted/Rejected Shares, Error Rate, Uptime, Pool Latency, Worker Status, Temperature, Power, and Efficiency. Fields are optional where a backend cannot provide them; backend-specific values remain in `extensions`.

`health()` remains an adapter contract method and returns an authority-neutral health report. IMAF does not perform institutional health monitoring.

An optional per-adapter classifier maps arbitrary backend failures into exactly ten categories: `ConfigurationFailure`, `DependencyFailure`, `HardwareIncompatible`, `DriverFailure`, `NetworkFailure`, `PoolFailure`, `AuthenticationFailure`, `ProcessFailure`, `RuntimeFailure`, and `UnknownFailure`. A deterministic structural fallback is available when no adapter-specific classifier is registered.

---

# 11. Security and Secret Redaction

Adapter preparation receives an injected `SecretProvider` and component ID, not a secret store. Raw wallet/pool credentials are prohibited from `MiningInstitutionalConfig`; only `walletSecretId` and `passwordSecretId` references may appear. Adapters can retrieve a secret only through the injected provider at the point an adapter implementation legitimately needs it.

`assertNoRawCredentials()` rejects sensitive configuration fields, and `redactSecrets()` deep-copies/redacts secret-bearing keys and known secret values. `MiningAdapterFramework.diagnostics()` always applies redaction before returning adapter diagnostics. IMAF does not write secrets to arbitrary files and does not expose a secret-storage API.

---

# 12. Adapter Certification and Explainability

IMAF's lightweight adapter-certification registry tracks deterministic, explainable adapter readiness levels: Uncertified, Experimental, Development, Qualified, Production, Mission Critical, and Revoked. This is explicitly distinct from IHCA hardware certification and makes no call to `core/certification_authority/`.

Capability explanations state every passed/failed check and whether the adapter can execute. Error explanations state the resulting category, classifier source, retryability, code when present, and rationale. These are descriptive outputs, not mining authorization or a control decision.

---

# 13. Adapter Events

IMAF publishes `AdapterDiscovered`, `AdapterRegistered`, `AdapterValidated`, `AdapterRejected`, `AdapterConfigured`, `MinerPrepared`, `MinerStarted`, `MinerStopped`, `MinerFailed`, `MinerRecovered`, and `MinerStatisticsUpdated` under the additive Event Bus `mining-adapter` category. Local publication is synchronous; institutional mirroring is best effort and never changes lifecycle ownership.

The added Data Authority domains `mining-adapter-registry` and `mining-adapter-history` reserve future storage governance without making IMAF a data-storage authority in this phase.

---

# 14. Acceptance Criteria

Phase 24 is complete when: a universal adapter contract exists; multiple backend-shaped adapters satisfy it; miner process shapes are abstracted without spawning a process; configuration translation works; statistics and all ten error categories normalize; capability negotiation is deterministic; the guarded lifecycle covers success/failure/rejection; adapter certification works; secret references/redaction are enforced; all eleven events publish; no forbidden authority import exists; documentation is complete; and tests pass without regression.
