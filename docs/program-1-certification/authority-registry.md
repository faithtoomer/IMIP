# Program I — Authority Registry Status

Cross-references `architecture/AUTHORITY_REGISTRY.md` (Phase 01, 19 authorities defined) against actual implementation state.

| Authority | Phase 01 Status | Program I Status | Evidence |
|---|---|---|---|
| Configuration Authority | Defined | **Implemented** (as ICMS) | `core/configuration_authority/`, ADR-0005 |
| Hardware Authority | Defined | **Implemented** (as IHIS) | `core/hardware_authority/`, ADR-0008 |
| Capability Registry Authority | Defined | Reserved | `core/capability_registry/README.md`, ADR-0002 |
| Plugin Registry Authority | Defined | Reserved (no module at all) | — |
| Mining Authority | Defined | Not started | — |
| Decision Intelligence Authority | Defined | Not started | — |
| Profitability Authority | Defined | Not started | — |
| Power Authority | Defined | Not started | — |
| Thermal Authority | Defined | Not started | — |
| Health Authority | Defined | Not started | — |
| Scheduler Authority | Defined | Not started | — |
| Telemetry Authority | Defined | Not started | — |
| Database Authority | Defined | Not started | — |
| Security Authority | Defined | Not started | — |
| Workload Authority | Defined | Not started | — |
| Notification Authority | Defined | Not started | — |
| Earnings Authority | Defined | Not started | — |
| Policy Authority | Defined | Reserved | `core/policy_engine/README.md`, ADR-0004 |
| Machine Learning Authority (future) | Defined | Not started | — |

**2 of 19** domain authorities implemented. Two additional pieces of **infrastructure** (not domain authorities in Phase 01's registry) were built to support them:

| Infrastructure | Status | Evidence |
|---|---|---|
| Institutional Event Bus (IEB) | **Implemented** | `core/event_bus/`, ADR-0009 |
| Runtime Bootstrap (IRBLM) | **Implemented** | `core/runtime_bootstrap/`, ADR-0010 |

## Ownership Boundaries Actually Enforced

- Configuration Authority is the sole owner of all 44 registered configuration keys (`ConfigurationRegistry.register()` throws on duplicates) — no other authority defines configuration.
- Hardware Authority is the sole owner of hardware discovery and state (`HardwareRegistry.upsert()` keyed by deviceId) — no other authority discovers hardware.
- The IEB is the sole *transport* — but not yet the sole *event mechanism*: ICMS and IHIS still run their own local `EventEmitter` for backward-compatible synchronous delivery, mirroring onto the IEB rather than routing through it exclusively (ADR-0009 §6). IRBLM has no such carve-out; it uses the IEB directly.
