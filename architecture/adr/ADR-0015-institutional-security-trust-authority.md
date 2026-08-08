# ADR-0015: Institutional Security & Trust Authority

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 12  
**Deciders:** Architectural Authority (Specification), User (naming/scope framing)

## Context

The user again avoided a conventional name — "Security Authority" — for a richer institutional concept: security *governance* and *trust* between every authority, plugin, component, and operator, framed explicitly around future third-party plugins, fleet management, remote agents, and enterprise deployments. Before writing code, per the user's explicit instruction ("review the following specs for duplication, redundancies, contradictions, and conflicts"), the spec was checked against `AUTHORITY_REGISTRY.md`, `DECISION_PIPELINE.md`, ICMS's existing security mechanism, IOLA's existing masking, and `PLUGIN_CONTRACT.md`.

That review found:

1. `DECISION_PIPELINE.md` already has a stage literally called "Authorization" (stage 9, owned by Decision Intelligence Authority) — gating whether a *specific mining decision* proceeds. ISTA's "Authorization Engine" is a completely different concept: access control, is this caller allowed to invoke this operation at all. Same word, two unrelated authorities.
2. ICMS already has a real, working 5-tier `SecurityClassification` (`public|internal|confidential|restricted|secret`) with display-time masking (`shouldMask()`/`maskSensitiveValues()`) — but no vault, no encryption at rest, no rotation. Narrower and complementary, not a duplicate of ISTA's Secret Vault.
3. IOLA already does unconditional pattern-based masking of log context (Phase 10). Complementary defense-in-depth, not duplicative — Law 6 explicitly wants multiple independent layers.
4. The Capability/Plugin Registry (both reserved) have no trust/certification concept at all — ISTA's Trust Registry is new territory, ready the moment plugins exist.
5. `PLUGIN_CONTRACT.md` already explicitly lists "Security Authority" as a prohibited plugin-implementable surface — confirms ISTA fills an already-anticipated slot.
6. A real, non-blocking observation: ICMS's `requestUpdate()` currently takes `initiatingAuthority` as a self-reported string with zero verification — a natural future integration point for ISTA's authorization engine, not retrofitted this phase.

No genuine forks required the user's decision this time (unlike Phase 11's two) — §22's wording ("I recommend adding from the beginning") was unambiguous, unlike Phase 10/11's "reserve from the beginning."

## Decisions

1. **ISTA's authorization is documented throughout as "Access Authorization,"** never bare "Authorization," to keep it distinct from `DECISION_PIPELINE.md` stage 9's mining-decision authorization. No code or naming change was needed elsewhere — this is a documentation discipline, not a conflict requiring resolution.
2. **The Secret Vault reuses AES-256-GCM via `node:crypto`** (no new dependency, same precedent as `node:sqlite`/`fs.statfsSync`/`systeminformation`), keyed via `scrypt` from a caller-supplied master key. Constructing `SecurityAuthority` without one degrades gracefully — Trust/Permission/Audit/Crypto services stay usable, only secret store/retrieve throws `SecretVaultNotConfiguredError` — rather than making every consumer configure a master key just to use ISTA's other features.
3. **Every public decision method (`authorize`, `retrieveSecret`, `storeSecret`, `rotateSecret`) is synchronous, mirroring events onto the IEB (ADR-0009 §6 pattern), not publishing directly like ISOA/IRBLM.** ISTA is framed by the user as "one of the most important authorities in the entire platform," and every other synchronous authority (IDA, ICMS, ISMA) may eventually need to call ISTA inline from its own synchronous methods — keeping the core decision surface synchronous maximizes that future compatibility at low present cost.
4. **An unregistered `permissionId` is `AuthorizationFailed`, distinct from a normal `PermissionDenied` decision.** The request itself is malformed (nothing to evaluate), which is a different failure class than "properly evaluated, and denied" — conflating the two would make `AuthorizationFailed`'s explainability meaningless.
5. **`revokeGrant()` has no corresponding IEB event name** (the spec's 11-event list has `PermissionGranted` but no `PermissionRevoked`). Rather than fabricate one, it logs through IOLA only (`grant-revoked`) — the same treatment ISOA gave `pause`/`resume` (ADR-0014 §8).
6. **`checksum()` is a distinct function from `sha256Hex()`**, even though both currently compute the same SHA-256 digest — the spec lists "Hashing" and "Checksum generation" as separate services (§11), and callers should be able to name the one they mean without the implementation detail that they're currently identical leaking into call sites.
7. **Signature verification (`SignatureVerifier`) and ABAC (`AttributePolicy`) are both real, generic extension points with no default rules/implementation**, honestly matching the spec's own "(future)" and "readiness" framing rather than fabricating either.
8. **§10's "Policies remain externalized through the Configuration Authority" is satisfied architecturally, not via a deep ICMS integration this phase.** ISTA never hardcodes role/permission values in its own source; `registerRole()`/`grant()` are the real mechanism, ready for an ICMS-sourced feed later with zero changes to ISTA itself.
9. **The Institutional Security Posture Model (§22) is built in full**, per the user's unambiguous direction.

## Consequences

- ISTA's authorization and `DECISION_PIPELINE.md`'s mining-decision authorization coexist without collision as long as both are consistently referred to by their distinct names in future documentation and code.
- ICMS's `SecurityClassification`/masking, IOLA's log masking, and ISTA's Secret Vault form a genuine three-layer defense-in-depth stack (display redaction, log redaction, actual encrypted storage) rather than three competing implementations of the same idea.
- Any future authority (or ICMS itself) that wants real access-control gating calls `ista.authorize()` synchronously — no async boundary to work around.
- The ICMS `requestUpdate()` verification gap remains a real, identified, but explicitly deferred integration opportunity.
