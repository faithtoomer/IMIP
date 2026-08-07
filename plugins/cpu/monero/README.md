# plugins/cpu/monero/

**Capability Class:** CPU  
**Transitional Source:** `Monero_Engine`  
**Phase 00 Status:** Location established

## Owns (when implemented)

- XMRig Adapter
- RandomX configuration
- Monero statistics parser
- Monero capability registration
- Monero benchmarking

## Does Not Own

- Configuration Authority
- Scheduler
- Database
- Profitability calculations
- Logging framework
- Dashboard
- Decision Engine

## Migration Note

Phase 00 establishes this plugin slot. Source tree `Monero_Engine/` was not present in this repository at migration time; no runtime files were moved. Implementation content is deferred to a future approved specification. No placeholder implementation is introduced here.
