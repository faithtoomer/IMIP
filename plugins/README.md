# plugins/

Mining implementations.

## Ownership

Plugins own only implementation-specific functionality.

Plugins never own platform logic.

## Capability Classes

```text
plugins/
├── cpu/
│   └── monero/
├── gpu/
│   └── flux/
└── asic/
```

## Laws

- Plugins are institutional extensions.
- Plugins shall never become applications.
- Every plugin must implement the approved plugin contract.
- Discovery is through manifests only (when implemented).
- Directory names are organizational, not authoritative.

See:

- `architecture/contracts/PLUGIN_CONTRACT.md`
- `architecture/contracts/PLUGIN_MANIFEST_STANDARD.md`
- `architecture/contracts/CAPABILITY_CLASSIFICATION.md`
