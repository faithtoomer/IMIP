# Runtime Topology Diagram

**Status:** Architecture Artifact (Phase 01)  
**Authority:** PHASE-01 §4 / §15 (Deliverable 3)

```mermaid
flowchart TD
    User --> Dashboard
    Dashboard --> API["REST / WebSocket API"]
    API --> DIE["Decision Intelligence Engine"]
    DIE --> ACL["Authority Coordination Layer"]

    ACL --> Configuration
    ACL --> Hardware
    ACL --> Telemetry
    ACL --> Profitability
    ACL --> Scheduler
    ACL --> Thermal
    ACL --> Power
    ACL --> Health
    ACL --> PluginRegistry["Plugin Registry"]
    ACL --> Workload
    ACL --> Security

    Configuration --> PM["Plugin Manager"]
    Hardware --> PM
    Telemetry --> PM
    Profitability --> PM
    Scheduler --> PM
    Thermal --> PM
    Power --> PM
    Health --> PM
    PluginRegistry --> PM
    Workload --> PM
    Security --> PM

    PM --> CPU["CPU Plugins"]
    PM --> GPU["GPU Plugins"]

    CPU --> MAL["Mining Adapter Layer"]
    GPU --> MAL

    MAL --> MS["Mining Software"]
    MS --> Pools["Mining Pools"]
```

## Rule

No authority may bypass this runtime. Every path from `User` to `Mining Pools` flows through the Decision Intelligence Engine and the Authority Coordination Layer.

See `specs/PHASE-01-institutional-system-architecture-runtime-blueprint.md` §4.
