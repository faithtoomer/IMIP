# Phase 00 — Repository Tree

**Generated:** 2026-08-07  
**Specification:** `specs/PHASE-00-repository-governance.md`

```text
IMIP/
├── README.md
├── architecture/
│   ├── README.md
│   ├── GOVERNANCE.md
│   ├── adr/
│   │   ├── ADR-0001-repository-architecture.md
│   │   └── ADR-0002-platform-capability-registry.md
│   ├── contracts/
│   │   ├── CAPABILITY_CLASSIFICATION.md
│   │   ├── PLUGIN_CONTRACT.md
│   │   └── PLUGIN_MANIFEST_STANDARD.md
│   └── diagrams/
│       └── README.md
├── specs/
│   ├── README.md
│   └── PHASE-00-repository-governance.md
├── core/
│   ├── README.md
│   └── capability_registry/
│       └── README.md
├── plugins/
│   ├── README.md
│   ├── cpu/
│   │   ├── README.md
│   │   └── monero/
│   │       └── README.md
│   ├── gpu/
│   │   ├── README.md
│   │   └── flux/
│   │       └── README.md
│   └── asic/
│       └── README.md
├── dashboard/
│   └── README.md
├── api/
│   └── README.md
├── database/
│   └── README.md
├── scripts/
│   └── README.md
├── tools/
│   └── README.md
├── tests/
│   ├── README.md
│   ├── platform/
│   ├── plugins/
│   ├── integration/
│   ├── stress/
│   └── certification/
├── docs/
│   ├── README.md
│   └── phase-00/
│       ├── repository-tree.md
│       ├── migration-report.md
│       ├── file-movement-summary.md
│       ├── directory-responsibility-summary.md
│       ├── validation-report.md
│       └── certification-checklist.md
└── .cursor/
    ├── README.md
    └── rules/
        └── imip-governance.mdc
```

## Spec Alignment

| Required Top-Level | Present |
|--------------------|---------|
| architecture/ | Yes |
| specs/ | Yes |
| core/ | Yes |
| plugins/ | Yes |
| dashboard/ | Yes |
| api/ | Yes |
| database/ | Yes |
| scripts/ | Yes |
| tools/ | Yes |
| tests/ | Yes |
| docs/ | Yes |
| .cursor/ | Yes |

| Required Plugin Slot | Present |
|----------------------|---------|
| plugins/cpu/monero/ | Yes |
| plugins/gpu/flux/ | Yes |
| plugins/asic/ | Yes |

| Required Reservation | Present |
|----------------------|---------|
| core/capability_registry/ | Yes |
