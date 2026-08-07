# core/

Institutional platform logic.

## Ownership

Core owns every institutional capability, including:

- Configuration
- Decision Engine
- Runtime
- Scheduler
- Telemetry
- Logging
- Hardware Detection
- Health Monitoring
- Profitability
- AI
- Event Bus
- Security
- Dashboard Integration
- Database Access
- Metrics
- Explainability
- Platform Capability Registry (reserved)

## Prohibitions

- Never coin logic
- Never miner logic
- Never plugin-specific adapters

## Phase 00

Core directories are established. No platform modules are implemented in Phase 00.

### Reserved

```text
core/capability_registry/
```

See `capability_registry/README.md` and `architecture/adr/ADR-0002-platform-capability-registry.md`.
