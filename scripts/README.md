# scripts/

Operational scripts for platform administration and maintenance.

## Available Scripts

| Script | Purpose |
|--------|---------|
| `local-pc-bootstrap.sh` | Verify/create Phase 00 institutional directories on a local PC; optionally import `Monero_Engine` / `Flux_Engine` into approved plugin slots |

## Local PC Bootstrap

```bash
chmod +x scripts/local-pc-bootstrap.sh
./scripts/local-pc-bootstrap.sh
```

With engine import:

```bash
./scripts/local-pc-bootstrap.sh \
  --monero-src /path/to/Monero_Engine \
  --flux-src /path/to/Flux_Engine
```

Full instructions: `docs/phase-00/local-pc-setup.md`
