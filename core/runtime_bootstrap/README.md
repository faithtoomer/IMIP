# Institutional Runtime Bootstrap & Lifecycle Manager (IRBLM)

**Status:** IMPLEMENTED (Phase 07)  
**Location:** `core/runtime_bootstrap/`  
**Authority:** PHASE-07 / ADR-0010

## Purpose

IRBLM assembles, validates, initializes, supervises, and gracefully shuts down IMIP. No authority initializes itself outside this process. It is generic by design — a dependency-graph-driven orchestrator, not a hardcoded sequence of named authorities — because most of the authorities its own spec diagram names (Capability Registry, Plugin Registry) don't exist as code yet.

## Layout

```text
core/runtime_bootstrap/
  src/
    types.ts                 ComponentDefinition contract, RuntimeState, GovernanceRecord,
                               CertificationResult, RUNTIME_EVENTS, ...
    errors.ts                  Structured, typed error taxonomy
    dependencyGraph.ts           DependencyGraph — topological startup/shutdown ordering,
                                  circular/missing-dependency detection
    lifecycleStateMachine.ts       12-state transition table
    governanceBoard.ts               RuntimeGovernanceBoard — the Architect's Enhancement (§22)
    certification.ts                  certifyRuntime() — generic readiness+health gate
    adapters.ts                        ComponentDefinitions wrapping the 3 real authorities
                                        (Institutional Event Bus, Configuration Authority,
                                        Hardware Authority) without modifying their source
    RuntimeOrchestrator.ts               Orchestrator: boot/shutdown/restart/pause/resume/
                                          recover, publishing all 14 runtime events directly
                                          through the real IEB
    index.ts                              Public exports
  tests/                                   75 tests across 14 files
```

## Usage

```ts
import { InstitutionalEventBus, MemoryEventPersistence } from '../event_bus/src/index.js';
import { RuntimeOrchestrator, configurationAuthorityComponent, hardwareAuthorityComponent } from './core/runtime_bootstrap/src/index.js';

const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
const runtime = new RuntimeOrchestrator(bus); // Event Bus is auto-registered as a component

runtime.registerComponent(configurationAuthorityComponent({ filePath: './imip.config.json' }));
runtime.registerComponent(hardwareAuthorityComponent());

const certification = await runtime.boot(); // throws BootstrapFailedError / CertificationFailedError on failure
console.log(runtime.getRuntimeState()); // 'operational'

// Explainability, at any time:
runtime.board.whyUnavailable('Hardware Authority');
runtime.board.blockingComponents();
runtime.getMetrics();

await runtime.requestShutdown();
```

## Scope Boundary

IRBLM owns bootstrap sequencing, dependency/readiness verification, certification, lifecycle state, shutdown/restart/recovery, and runtime diagnostics — never mining, scheduling, hardware discovery, profitability, plugin execution, or decision-making (§4).

## Governance

- Nothing initializes before its dependencies successfully initialize (Law 2) — a dependency that was merely *created* but failed to *initialize* still counts as unavailable to its dependents.
- Strict mode (default) never allows the platform to reach Operational with a failed component; `allowPartialStartup: true` is required, explicit authorization (Law 6), and failed components remain fully visible in the Governance Board even then.
- Certification blocks on `faulted` health, never on `degraded` — degraded-but-running is a first-class, intentional state (§22).
- Capability Registry and Plugin Registry have no adapters here because there is nothing to adapt yet (both reserved) — they register the same way the moment they exist, no orchestrator changes required.
