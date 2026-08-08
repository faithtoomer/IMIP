# Capability Classification

**Status:** Architectural Standard  
**Phase:** 00  
**Authority:** PHASE-00 Repository Governance

## Classification Model

Plugins are categorized by capability class under `plugins/`:

```text
plugins/
├── cpu/
├── gpu/
├── asic/
```

Future capability classes may be added without repository redesign:

```text
plugins/
├── cpu/
├── gpu/
├── asic/
├── fpga/
├── cloud/
```

## Established Plugin Slots

| Source (transitional) | Capability | Target |
|-----------------------|------------|--------|
| `Monero_Engine` | CPU | `plugins/cpu/monero/` |
| `Flux_Engine` | GPU | `plugins/gpu/flux/` |

## Rules

1. Every plugin resides under exactly one capability class.
2. Capability class directories organize plugins; they do not replace manifests.
3. New classes require architectural approval for naming, not structural redesign of Core.
4. Core and PCR remain unaware of directory layout specifics; they consume registered capabilities.
