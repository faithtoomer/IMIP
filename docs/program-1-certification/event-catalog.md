# Program I — Event Catalog

Every event type registered with the Institutional Event Bus across all three publishing modules. 35 total. Source of truth: `CONFIG_EVENTS` (`core/configuration_authority/src/events.ts`), `HARDWARE_EVENTS` (`core/hardware_authority/src/events.ts`), `RUNTIME_EVENTS` (`core/runtime_bootstrap/src/types.ts`).

## Configuration Authority (ICMS) — category `configuration`, publisher `Configuration Authority`

Delivery: `async` · Targeting: `broadcast` · Priority: `normal` (all 10)

| Event | Fires when |
|---|---|
| `ConfigurationLoaded` | `load()` completes successfully |
| `ConfigurationValidated` | The 9-stage pipeline passes |
| `ConfigurationRejected` | Any stage fails, or startup config is invalid |
| `SnapshotCreated` | A new immutable snapshot is built |
| `SnapshotActivated` | A snapshot becomes current |
| `SnapshotRolledBack` | `rollback()` reactivates a prior snapshot |
| `ConfigurationChanged` | `requestUpdate()` succeeds |
| `ConfigurationMigrated` | One or more migrations applied during load |
| `SecretResolved` | A confidential/restricted/secret key is sourced from the secrets store |
| `ConfigurationReloaded` | `reload()` is called (convenience event, not in the original §16 minimum) |

## Hardware Authority (IHIS) — category `hardware`, publisher `Hardware Authority`

Delivery: `async` · Targeting: `broadcast` · Priority: `normal`, except `HardwareFaultDetected` = `high`

| Event | Fires when |
|---|---|
| `HardwareDiscovered` | A new device is found and capability-assessed |
| `HardwareRemoved` | A previously known device disappears from discovery |
| `HardwareUpdated` | A known device's data changes on re-discovery |
| `DeviceRegistered` | A new device reaches the `registered` lifecycle stage |
| `DeviceAvailable` | A device's runtime state becomes `available` |
| `DeviceReserved` | `reserve()` succeeds |
| `DeviceReleased` | `releaseReservation()` succeeds |
| `CapabilityChanged` | A device's assessed capability set changes across discoveries |
| `DriverChanged` | A device's driver version changes |
| `BenchmarkCompleted` | `recordBenchmark()` is called |
| `HardwareFaultDetected` | A discovery failure, duplicate-id collision, inventory inconsistency, or `recordFault()` occurs |

## Runtime Bootstrap (IRBLM) — category `runtime`, publisher `Runtime Bootstrap`

Delivery: `sync` · Targeting: `broadcast` · Priority: `normal`, except `RuntimeFaulted` = `critical`

| Event | Fires when |
|---|---|
| `BootstrapStarted` | `boot()` begins |
| `InitializationStarted` | The per-component create+initialize pass begins |
| `InitializationCompleted` | That pass ends (successes and failures both included in payload) |
| `ReadinessVerified` | The distinct readiness-check pass completes |
| `RuntimeCertified` | `certifyRuntime()` returns `certified: true` |
| `RuntimeOperational` | The platform transitions to `operational` |
| `BootstrapCompleted` | `boot()` returns successfully |
| `RuntimePaused` / `RuntimeResumed` | `pause()` / `resume()` |
| `ShutdownRequested` / `ShutdownCompleted` | `requestShutdown()` starts / finishes |
| `RestartRequested` | `requestRestart()` is called (full or single-component) |
| `RuntimeRecovered` | `recover()` succeeds |
| `RuntimeFaulted` | Any strict-mode boot failure, certification failure, or failed recovery |

## Categories Reserved, Not Yet Populated

`capability`, `plugin`, `mining`, `scheduler`, `power`, `thermal`, `health`, `database`, `security`, `profitability`, `decision`, `ai`, `dashboard`, `notification`, `diagnostics` — all exist in `EventCategory` (`core/event_bus/src/types.ts`) but have zero registered events, since the authorities that would own them don't exist yet.
