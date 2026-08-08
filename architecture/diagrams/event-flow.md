# Event Flow Diagram

**Status:** Architecture Artifact (Phase 01)  
**Authority:** PHASE-01 §10 / §15 (Deliverable 4)

```mermaid
flowchart LR
    subgraph Publishers
        A1["Institutional Authorities"]
        A2["Capability Layer"]
        A3["Plugin Layer (via Plugin Registry Authority)"]
    end

    subgraph Bus["Event Bus"]
        direction TB
        Hardware
        Mining
        Thermal
        Power
        Decision
        Profitability
        Security
        Health
        AI
        Notifications
        Scheduler
        Configuration
    end

    subgraph Subscribers
        B1["Institutional Authorities"]
        B2["Decision Intelligence Authority"]
        B3["Presentation Layer (Dashboard/API)"]
    end

    A1 --> Bus
    A2 --> Bus
    A3 --> Bus
    Bus --> B1
    Bus --> B2
    Bus --> B3
```

## Rules

1. Every authority publishes events; no authority calls another authority directly.
2. Every authority subscribes only to the event categories it is approved to consume.
3. No direct event coupling — publishers do not know their subscribers.
4. Minimum event categories: Hardware, Mining, Thermal, Power, Decision, Profitability, Security, Health, AI, Notifications, Scheduler, Configuration.

## Phase 01 Note

No Event Bus implementation exists yet. This diagram fixes the category model and publish/subscribe rule for future implementation.
