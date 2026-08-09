# ADR-0027: Institutional ASIC Mining Framework & ASIC Fleet Digital Twin

**Status:** Accepted  
**Date:** 2026-08-09  
**Phase:** 27  
**Deciders:** Architectural Authority (Specification)

## Context

IMIP needs a reusable multi-ASIC execution layer for future coin plugins without embedding a coin, production algorithm, named miner, vendor SDK, local/network protocol, or competing ASIC-resource state. ASIC identity/capabilities are source-owned by IHIS; ASIC and hashboard availability/reservations are owned by IRIA; power, thermal, health, and certification views are owned by IPIA, ITIA, IHIA, and IHCA. IMAF already owns the backend adapter contract and adapter lifecycle machinery.

An ASIC framework must preserve independent device identity, prevent cross-device control, and avoid turning framework state into another hardware, resource, health, or telemetry authority. Duplicating ASIC allocation, caching a profile, assuming a primary device, or implementing a vendor protocol would violate institutional ownership.

## Decision

- Implement IAMF at `core/asic_mining_framework/`, orchestrated by `AsicMiningFramework.ts`.
- Compose UUID-scoped ASIC mining sessions from injected IHIS-, IRIA-, IPIA-, ITIA-, IHIA-, and IHCA-shaped providers plus an already-selected IMAF `MiningAdapter` contract per session.
- Provide generic algorithm registration, deterministic capability negotiation, device/hashboard pre-validation, guarded lifecycle/audit, performance history, advisory telemetry, failure reporting, explainability, Event Bus publication, and append-only ASIC Fleet Digital Twin records.
- Publish ten events under additive `asic-mining` EventCategory and reserve `asic-mining-performance` / `asic-mining-digital-twin` Data Domains.

## ASIC Profile as a Composed View, Not a New Source of Truth

- `AsicProfileComposer` reads fresh source-provider snapshots each time and deliberately has no cache, inventory, allocation ledger, health store, telemetry store, or certification store.
- IHIS retains identity/capability/network fields; IRIA retains device/hashboard resource state; ITIA retains thermal state; IPIA retains power state; IHIA retains health/reliability; IHCA retains certification state.
- The composed profile is a defensive read snapshot for negotiation, validation, monitoring, explanation, and twin evidence. It cannot update an upstream source.

## Resource Allocation Comes from IRIA, Never Duplicated, Pre-Validated Before Request

- `AsicResourceManagement` checks matching ASIC UUID, provider-reported device availability, and every requested hashboard against the composed resource view before it invokes injected `AsicResourceProvider.reserve()`.
- Insufficient device/hashboard requirements fail before execution and before an IRIA request. A passed check is not a grant.
- IAMF owns no ASIC availability counter, hashboard ledger, allocation registry, ownership record, or self-grant path. Release uses only IRIA's returned reservation ID.

## Device Isolation and No-Primary-Device Guarantee

- ASIC UUID is first-class in profile composition, resource requests/grants, sessions, performance records, and Fleet Digital Twin records.
- `AsicIdentityRegistry` supports deterministic UUID lookup/listing but derives no primary/default meaning from ordering and makes no manufacturer/homogeneity assumption.
- `AsicIsolationGuard` permits one active claim per ASIC UUID. A second concurrent claim fails, and scope validation rejects an adapter/configuration/device-selection reference that differs from the granted UUID.
- Distinct UUIDs may run concurrently; release removes only the releasing session's claim.

## Vendor/Protocol Independence — Communication Mechanisms Live Entirely in Adapters

- IAMF contains no Bitmain, Whatsminer, Canaan, local API, network API, vendor API, Stratum, or device-management protocol implementation.
- A selected adapter owns all communication mechanisms. IAMF uses only established `MiningAdapter` identity/start/stop/statistics/health methods.
- Vendor coverage is test-only provider-shape parameterization. It does not create vendor support code in IAMF core.

## IMAF Adapter-Contract Composition

- IAMF type-imports only IMAF's published `MiningAdapter`, `AdapterManifest`, `NormalizedStatistics`, and `NormalizedError` contract vocabulary and accepts a concrete adapter reference through `AsicMiningConfig`.
- It does not instantiate `MiningAdapterFramework` or recreate IMAF registry, translation, normalizer, error classifier, secret context, backend configuration, or adapter lifecycle audit.
- The composition root or future Mining Authority selects/configures/prepares adapters and ISTA-style secret context before IAMF starts a session; IAMF retains opaque references only.

## Safety and Optimization Are Advisory

- The eight named ASIC failure conditions are reported with supplied/derived IMAF-normalized error evidence where applicable. IAMF never restarts/recoveries a backend, resets a miner, changes a power/thermal limit, changes certification, or reallocates resources.
- Optimization recommendations are immutable advisory data. Applying them requires appropriate authority and policy routing outside IAMF.

## Boundaries

- IAMF does **not** discover/inventory hardware, monitor health independently, allocate capacity, enforce power/thermal policy, certify hardware, retrieve/store secrets, authorize mining, schedule workload, select a coin, or implement a vendor/coin protocol.
- IAMF does **not** import or instantiate Hardware, Resource, Power, Thermal, Health, Security, Certification, Arbitration, Benchmark, Workload, or Scheduling Authority implementation classes.
- IAMF does **not** implement the mining adapter contract; it composes injected IMAF `MiningAdapter` references.
- Dependencies cross only through Event Bus publication, exported structural contracts, and injected providers.

## Consequences

- Future Program V plugins receive a stable, vendor-neutral ASIC execution surface while device/hashboard capacity remains centrally governed by IRIA.
- Concurrent ASIC work is safe at the framework boundary because UUID identity, adapter/configuration scope, and exclusive claims are checked before adapter start.
- ASIC Profile/Fleet Twin records remain fresh descriptive evidence instead of rival authority databases.
- Deterministic provider/clock injection makes tests cover Bitmain-, Whatsminer-, and Canaan-shaped devices without real SDKs or network dependencies.
- Program IV continues after this phase; later process-manager, statistics, plugin-runtime, and plugin-certification phases remain separate ownership work.

## Rejected Alternatives

- **Create an IAMF ASIC/hashboard ledger:** Rejected — duplicates IRIA and risks conflicting allocation ownership.
- **Cache/discover ASIC profiles in IAMF:** Rejected — creates a rival hardware/resource/health/certification source of truth.
- **Assume ASIC-001 is primary or all ASICs are alike:** Rejected — violates independent identity and vendor neutrality.
- **Allow two active sessions on an exclusive UUID:** Rejected — violates device isolation.
- **Implement vendor, local API, network API, Stratum, or device-management protocol in IAMF:** Rejected — communication belongs inside adapters.
- **Restart or reconfigure automatically after a detection:** Rejected — bypasses Resource, Power, Thermal, Health, Security, and policy ownership.
- **Instantiate/proxy MiningAdapterFramework:** Rejected — couples frameworks and duplicates IMAF lifecycle ownership.
- **Embed a real coin, algorithm, wallet secret, miner binary, or vendor SDK:** Rejected — Program V plugins/adapters and ISTA-style secret handling own those integrations.
