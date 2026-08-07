# Phase 00 — Local PC Setup

**Purpose:** Establish the IMIP institutional structure on a local workstation and optionally import transitional engine trees.

**Constraint:** A Cursor Cloud Agent cannot access your local PC directly. Run these steps on the machine itself (terminal or Cursor Desktop).

---

## 1. Pull the Phase 00 branch

```bash
git clone https://github.com/faithtoomer/IMIP.git
cd IMIP
git fetch origin cursor/phase-00-repository-governance-5130
git checkout cursor/phase-00-repository-governance-5130
```

If the repo is already cloned:

```bash
cd /path/to/IMIP
git fetch origin
git checkout cursor/phase-00-repository-governance-5130
git pull origin cursor/phase-00-repository-governance-5130
```

---

## 2. Bootstrap structure on the local PC

Verify/create the approved directories:

```bash
chmod +x scripts/local-pc-bootstrap.sh
./scripts/local-pc-bootstrap.sh
```

Dry run first (optional):

```bash
./scripts/local-pc-bootstrap.sh --dry-run
```

---

## 3. Import existing engines (if they exist on the PC)

If `Monero_Engine` / `Flux_Engine` already exist elsewhere on the local machine (for example under a `trading-server` workspace), import them into the approved plugin slots:

```bash
./scripts/local-pc-bootstrap.sh \
  --monero-src /path/to/Monero_Engine \
  --flux-src /path/to/Flux_Engine
```

Mapping:

| Source | Destination |
|--------|-------------|
| `Monero_Engine/` | `plugins/cpu/monero/` |
| `Flux_Engine/` | `plugins/gpu/flux/` |

The script moves files. It does not rewrite runtime logic.

After verification, remove empty source directories manually if desired.

---

## 4. Continue work in Cursor Desktop (recommended)

On the local PC:

1. Open the `IMIP` folder in Cursor Desktop.
2. Confirm branch `cursor/phase-00-repository-governance-5130`.
3. Ask the local agent to verify Phase 00 structure or import engines using the paths on that machine.

---

## 5. What this does / does not do

Does:

- Creates missing approved directories
- Verifies plugin slots and PCR reservation
- Optionally moves existing engine trees into plugin slots

Does not:

- Install miners
- Implement mining / AI / authorities
- Create placeholder implementations
- Modify runtime logic during import
