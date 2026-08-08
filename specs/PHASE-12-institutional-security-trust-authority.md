# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM II — CORE INFRASTRUCTURE

## Phase 12

# Institutional Security & Trust Authority (ISTA)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Core Infrastructure Authority

> ISTA fills the "Security Authority" slot named in `architecture/AUTHORITY_REGISTRY.md` (Phase 01) and explicitly prohibited to plugins in `architecture/contracts/PLUGIN_CONTRACT.md`. Expanded from access control alone into security *governance* — trust between every authority, plugin, component, and operator. See ADR-0015.

---

# 1. Mission Statement

ISTA is the sole authority for platform security governance, trust evaluation, authorization policies, credential protection, secret management, permission enforcement, security auditing, and operational trust. No authority independently implements authentication, authorization, credential storage, or security policy enforcement.

---

# 2. Mission Objectives

Security governance, trust management, authorization, permission management, secret management, credential protection, plugin trust evaluation, security auditing, cryptographic services, security diagnostics, explainable security decisions, a real extension point for future enterprise identity integration.

---

# 3. Institutional Principles

1. **Single Security Authority** — ISTA is the sole owner of security governance.
2. **Zero Implicit Trust** — a component with no `TrustRecord` is `untrusted` by definition; nothing is trusted merely because it exists.
3. **Least Privilege** — components receive only the permissions their responsibilities require.
4. **Secrets Never Leave ISTA** — the raw value of a stored secret is returned only to a caller `authorize()` has explicitly approved for `secret.access`; it never appears in logs, exceptions, events, or explainability output.
5. **Explainability** — every decision answers who/what/why/which-policy/which-permissions/which-trust-relationship.
6. **Defense in Depth** — ISTA's Secret Vault never hands secrets to a caller that would log them; IOLA's independent, unconditional log-context masking (Phase 10) is a second, non-redundant layer catching anything that slips through.

---

# 4. Responsibilities

ISTA owns: authorization, the Permission Registry, the Trust Registry, security policies, secret management, credential storage, encryption services, key management, security auditing, plugin trust, security diagnostics, security events. ISTA does **not** own: business logic, runtime scheduling, mining, profitability, hardware management, data persistence, or event routing.

---

# 5. Runtime Architecture

```text
Authorities
        │
        ▼
Institutional Security & Trust Authority
        │
        ├──────── Trust Registry
        ├──────── Permission Registry
        ├──────── Authorization Engine ("Access Authorization" — see §9 note)
        ├──────── Secret Vault (real AES-256-GCM, node:crypto)
        ├──────── Encryption Services
        ├──────── Security Policy (externalized values; §10)
        ├──────── Audit Engine
        └──────── Institutional Security Posture Model (§22)
```

Every public decision method (`authorize`, `retrieveSecret`, `storeSecret`, `rotateSecret`) is synchronous, mirroring events onto the real IEB (ADR-0009 §6 pattern) rather than publishing directly — a deliberate departure from ISOA's/IRBLM's direct-publish pattern, made specifically so any other synchronous authority can call ISTA inline. See ADR-0015.

---

# 6. Trust Registry

Every `TrustRecord` carries every field §6 requires. `signatureStatus` defaults honestly to `unsigned` — no PKI/signing infrastructure exists on this platform yet (§11 marks it "(future)" explicitly).

---

# 7. Permission Registry

The spec's own named example permissions (configuration, plugin, hardware, runtime, mining) are seeded as real, registered `PermissionDefinition`s — plus `secret.access`/`secret.manage`, required by ISTA's own Secret Vault gating. The registry is open to further registration, matching the "centrally managed" requirement.

---

# 8. Secret Management

Real AES-256-GCM encryption at rest (`node:crypto` — no new dependency), keyed via `scrypt` from a caller-supplied master key (sourced from an environment variable at the process boundary, the standard bootstrap point for every real secrets-management system). Constructing ISTA without a master key leaves Trust/Permission/Audit/Crypto services usable but throws `SecretVaultNotConfiguredError` on any actual secret store/retrieve attempt — graceful degradation, not a hard startup requirement. Secrets never appear in logs/exceptions/events/explainability output — enforced structurally: `retrieveSecret()` is the only path to a raw value, and every other surface (audit records, events, explainability) carries only metadata (`SecretRecord`), never the plaintext.

---

# 9. Authorization Engine

Deny-by-default RBAC (roles bundle permissions; direct grants also supported) plus a real ABAC-readiness extension point (`AttributePolicy`, no default rules — "readiness," not a claim of full ABAC). **Naming note, found during pre-implementation review**: `architecture/contracts/DECISION_PIPELINE.md` already has a stage literally called "Authorization" (stage 9, owned by Decision Intelligence Authority — gating whether a specific mining decision proceeds). ISTA's authorization is a completely different concept (access control). Documented throughout ISTA's own code/docs as "Access Authorization" to keep the two apart. See ADR-0015.

---

# 10. Security Policies

"Policies remain externalized through the Configuration Authority" is satisfied architecturally: ISTA never hardcodes role/permission *values* in its own source — `registerRole()`/`grant()` are the real, functional mechanism, ready for a future ICMS-sourced configuration feed without any change to ISTA itself. Not built as a deep two-way ICMS integration this phase (scope discipline — no live conflict forces it).

---

# 11. Cryptographic Services

`sha256Hex`, `checksum` (an intentionally separate name for the same primitive, since the spec lists "Hashing" and "Checksum generation" as distinct services callers should name explicitly), `secureRandomToken` — all via `node:crypto`. Digital signature verification is a real, generic extension point (`SignatureVerifier`) with no default implementation, honestly matching the spec's own "(future)" marking.

---

# 12. Security Auditing

`SecurityAuditTrail` — every field §12 requires, structurally immutable (no update/delete method exposed), mirroring `DataAuditTrail` (Phase 08) and `AuditLogTrail` (Phase 10) exactly.

---

# 13. Security Events

The 11 named events, registered under the `'security'` `EventCategory` — reserved and unused since Phase 01/05 (and already in IOLA's `DEFAULT_LOG_CATEGORIES` too), so no widening was needed. `revokeGrant()` has no corresponding "PermissionRevoked" event name in the spec's list; it logs through IOLA only (operation `grant-revoked`), the same treatment ISOA gave `pause`/`resume` (ADR-0014 §8) rather than fabricating an event name.

---

# 14. Explainability

`explain(componentId)` returns trust, active grants, recent audit records, and related posture findings together, not scattered across separate calls.

---

# 15. Public Interfaces

`registerTrust()`/`revokeTrust()`, `registerPermission()`/`registerRole()`/`grant()`/`revokeGrant()`, `authorize()`, `storeSecret()`/`retrieveSecret()`/`rotateSecret()`, `checkExpiredGrants()`, `reportSecurityWarning()`/`reportSecurityViolation()`/`reportPolicyUpdated()`, `explain()`, `getMetrics()`, plus the `trust`/`permissions`/`audit`/`posture` read surfaces. No consumer manipulates credentials or permissions directly.

---

# 16. Error Handling

`TrustNotFoundError`, `DuplicateTrustError`, `UnregisteredPermissionError`, `DuplicatePermissionError`, `RoleNotFoundError`, `GrantNotFoundError`, `AccessDeniedError`, `SecretVaultNotConfiguredError`, `SecretNotFoundError` — all typed. An unregistered `permissionId` in an `authorize()` call is treated as `AuthorizationFailed` (a malformed request), distinct from a normal `PermissionDenied` decision (a properly-evaluated deny).

---

# 17. Performance Metrics

`getMetrics()`: authorizationCount, authorizationDenials, averageAuthorizationLatencyMs, secretRetrievalCount, averageSecretRetrievalLatencyMs, securityViolationCount, trustValidationCount. Exposed to **the Observability Authority** (IOLA now exists) — every ISTA event is also logged through IOLA when configured.

---

# 18. Testing Requirements

60 tests across 9 files: the Trust Registry, the Permission Registry (including RBAC role bundling and grant expiry), cryptographic services (verified against known SHA-256 test vectors), the Secret Vault (real encryption round-trip, ciphertext-is-never-plaintext, cross-key isolation, graceful degradation without a master key, rotation, access counting), the immutable audit trail, the Institutional Security Posture Model, the event mirror, and the orchestrator end-to-end — zero-implicit-trust denial, deny-by-default, RBAC/ABAC gating, trust revocation, secret store/retrieve/rotate gated by real authorization, credential expiry notification, explainability, metrics, and real IEB/IOLA integration.

---

# 19. Acceptance Criteria

All authorization flows through ISTA. The Trust Registry is operational. The Permission Registry is authoritative. Secret management is centralized, with real encryption at rest. Security policies (role/grant values) are enforceable, externalizable. Authorization is deny-by-default. Security audit records are immutable. Security events are published. Explainability is complete. Tests pass. Documentation is complete.

---

# 20. Institutional Completion Standard (ICS) / Compliance Note

No placeholder implementations: encryption is real AES-256-GCM, hashing is real SHA-256, the ABAC-readiness and signature-verification extension points are honest about having no default rules/implementation rather than fabricating them. A pre-coding spec review (explicitly requested) found the "Authorization" naming collision with `DECISION_PIPELINE.md`, confirmed ICMS's existing 5-tier `SecurityClassification`/masking and IOLA's existing log masking are complementary (not duplicative) to ISTA's Secret Vault, and confirmed the `'security'` `EventCategory` required no widening.

---

# 22. Architect's Enhancement: Institutional Security Posture Model (ISPM)

**Implemented in full**, per unambiguous direction ("I recommend adding from the beginning" — unlike Phase 10/11's genuinely ambiguous "reserve from the beginning" wording, this needed no clarification). `InstitutionalSecurityPostureModel` aggregates real trust, secret-rotation, and audit-denial state into a single explainable score (0–100) and answers the spec's own example questions directly: `lowestTrustComponents()` ("which plugin or authority reduced the overall trust score?"), `credentialsRequiringRotation()` ("which credentials require rotation?"), `whyDenied()` ("why was a component denied access despite having a valid identity?"). Does not replace `authorize()`'s per-request decisions — it is a read-only, higher-level assessment layered on top of them, exactly as §22 specifies.
