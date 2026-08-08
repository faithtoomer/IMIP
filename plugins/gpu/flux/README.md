# plugins/gpu/flux/

**Capability Class:** GPU  
**Transitional Source:** `Flux_Engine`  
**Phase 00 Status:** Location established

## Owns (when implemented)

- Flux/GPU miner adapter surfaces
- Flux-specific configuration and statistics parsing
- Flux capability registration
- Flux benchmarking

## Does Not Own

- Configuration Authority
- Scheduler
- Database
- Profitability calculations
- Logging framework
- Dashboard
- Decision Engine

## Migration Note

Phase 00 establishes this plugin slot. Source tree `Flux_Engine/` was not present in this repository at migration time; no runtime files were moved. Implementation content is deferred to a future approved specification. No placeholder implementation is introduced here.
