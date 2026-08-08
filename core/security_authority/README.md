# Institutional Security & Trust Authority (ISTA)

**Status:** IMPLEMENTED (Phase 12)  
**Location:** `core/security_authority/`  
**Authority:** PHASE-12 / ADR-0015

## Purpose

ISTA is the sole institutional authority for security governance and trust — not just authentication and permissions, but establishing trust between every authority, plugin, component, and operator. It fills the "Security Authority" slot named in `architecture/AUTHORITY_REGISTRY.md` and already prohibited to plugins in `architecture/contracts/PLUGIN_CONTRACT.md`.

## Layout

```text
core/security_authority/
  src/
    types.ts               TrustLevel/Record, PermissionDefinition, Role, Grant,
                             AuthorizationRequest/Decision, SecretRecord, SECURITY_EVENTS (11)
    errors.ts                 Structured, typed error taxonomy
    trustRegistry.ts             TrustRegistry — SSOT, Law 2 "Zero Implicit Trust"
    permissionRegistry.ts          PermissionRegistry — permissions, roles, grants (RBAC)
    crypto.ts                        Cryptographic Services (node:crypto, no new dependency)
    secretVault.ts                     SecretVault — real AES-256-GCM encryption at rest
    auditTrail.ts                        SecurityAuditTrail — structurally immutable
    events.ts                              SecurityEventBus — mirrors onto the real IEB
    posture.ts                              InstitutionalSecurityPostureModel — the
                                             Architect's Enhancement (§22)
    SecurityAuthority.ts                     The orchestrator
    index.ts                                  Public exports
  tests/                                       60 tests across 9 files
```

## Usage

```ts
import { SecurityAuthority } from './core/security_authority/src/index.js';

const ista = new SecurityAuthority({ masterKey: process.env.IMIP_MASTER_KEY });

// Law 2 — nothing is trusted until explicitly registered:
ista.registerTrust({
  componentId: 'monero-plugin',
  componentType: 'plugin',
  identity: 'Monero CPU Plugin',
  trustLevel: 'basic',
  certificationStatus: 'uncertified',
  riskClassification: 'medium',
});

ista.grant('monero-plugin', { permissionId: 'mining.start', grantedBy: 'Operator' });

const decision = ista.authorize({ componentId: 'monero-plugin', permissionId: 'mining.start', operation: 'start-mining' });
if (!decision.approved) throw new Error(decision.reasons.join('; '));

// Secret Vault — real encryption at rest, gated by the same authorization engine:
ista.grant('monero-plugin', { permissionId: 'secret.manage', grantedBy: 'Operator' });
ista.grant('monero-plugin', { permissionId: 'secret.access', grantedBy: 'Operator' });
ista.storeSecret('pool-1-password', 'pool-credential', 'real-password', 'monero-plugin');
const password = ista.retrieveSecret('pool-1-password', 'monero-plugin'); // throws AccessDeniedError if not authorized

// The Institutional Security Posture Model (§22):
ista.posture.evaluate();                         // aggregate score + findings
ista.posture.credentialsRequiringRotation();      // §22 example question
ista.posture.lowestTrustComponents();             // §22 example question
```

## Scope Boundary

ISTA owns authorization, the Permission/Trust Registries, security policies (values externalized), secret management, encryption services, key management, security auditing, plugin trust, and security diagnostics — never business logic, runtime scheduling, mining, profitability, hardware management, data persistence, or event routing (§4).

## Governance

- **"Access Authorization" is a deliberately distinct concept** from `DECISION_PIPELINE.md` stage 9's mining-decision "Authorization" (owned by Decision Intelligence Authority) — same word, unrelated authorities, documented apart throughout.
- Deny-by-default: an unregistered component, an untrusted component, a missing grant, or a failing `AttributePolicy` all result in denial. An unregistered `permissionId` is a distinct `AuthorizationFailed` (malformed request), not a normal deny.
- Secrets never leave ISTA except through `retrieveSecret()`, itself gated by `authorize()` — every other surface (audit, events, explainability) carries only `SecretRecord` metadata, never the raw value.
- ICMS's existing `SecurityClassification`/masking and IOLA's existing log-context masking are complementary defense-in-depth layers, not duplicated here.
- `authorize()`/`retrieveSecret()`/`storeSecret()`/`rotateSecret()` are synchronous — callable inline from any other authority's own synchronous methods.
- `AuditTrail` and `SecurityAuditTrail` both expose no update or delete method for any reason — immutability is structural.
