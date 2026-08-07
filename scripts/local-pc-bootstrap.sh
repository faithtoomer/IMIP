#!/usr/bin/env bash
# IMIP Phase 00 — Local PC bootstrap
# Establishes/verifies institutional structure and optionally imports
# transitional engine trees into approved plugin slots.
#
# Usage:
#   ./scripts/local-pc-bootstrap.sh
#   ./scripts/local-pc-bootstrap.sh --monero-src /path/to/Monero_Engine --flux-src /path/to/Flux_Engine
#
# Laws honored:
#   - No feature implementation
#   - Prefer moves over recreation when importing engines
#   - Preserve existing files

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MONERO_SRC=""
FLUX_SRC=""
DRY_RUN=0

usage() {
  cat <<'EOF'
IMIP local PC bootstrap (Phase 00)

Usage:
  ./scripts/local-pc-bootstrap.sh [options]

Options:
  --monero-src PATH   Path to transitional Monero_Engine directory to import
  --flux-src PATH     Path to transitional Flux_Engine directory to import
  --dry-run           Show actions without changing files
  -h, --help          Show this help

Without source paths, this script only verifies the institutional structure
and creates any missing approved directories.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --monero-src)
      MONERO_SRC="${2:-}"
      shift 2
      ;;
    --flux-src)
      FLUX_SRC="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

REQUIRED_DIRS=(
  architecture
  architecture/adr
  architecture/contracts
  architecture/diagrams
  specs
  core
  core/capability_registry
  plugins
  plugins/cpu
  plugins/cpu/monero
  plugins/gpu
  plugins/gpu/flux
  plugins/asic
  dashboard
  api
  database
  scripts
  tools
  tests
  tests/platform
  tests/plugins
  tests/integration
  tests/stress
  tests/certification
  docs
  docs/phase-00
  .cursor
)

echo "==> IMIP local PC bootstrap"
echo "    Root: $ROOT"
echo

echo "==> Verifying / creating approved directories"
for dir in "${REQUIRED_DIRS[@]}"; do
  if [[ -d "$dir" ]]; then
    echo "    OK   $dir"
  else
    echo "    MKDIR $dir"
    run mkdir -p "$dir"
  fi
done
echo

import_engine() {
  local label="$1"
  local src="$2"
  local dest="$3"

  if [[ -z "$src" ]]; then
    echo "==> $label import skipped (no -- source provided)"
    echo "    Target reserved at: $dest"
    return 0
  fi

  if [[ ! -d "$src" ]]; then
    echo "ERROR: $label source not found: $src" >&2
    exit 1
  fi

  echo "==> Importing $label"
  echo "    From: $src"
  echo "    To:   $dest"

  # If destination only has ownership README / empty, allow merge-in.
  local dest_file_count
  dest_file_count="$(find "$dest" -type f ! -name 'README.md' ! -name '.gitkeep' 2>/dev/null | wc -l | tr -d ' ')"

  if [[ "$dest_file_count" != "0" ]]; then
    echo "ERROR: destination already contains non-governance files: $dest" >&2
    echo "       Refusing to overwrite. Move or clear plugin content first." >&2
    exit 1
  fi

  # Preserve governance README if present, then move source contents in.
  local tmp_readme=""
  if [[ -f "$dest/README.md" ]]; then
    tmp_readme="$(mktemp)"
    cp "$dest/README.md" "$tmp_readme"
  fi

  # Move contents (not the directory wrapper) to preserve caller ownership of src path cleanup.
  local item
  shopt -s dotglob nullglob
  for item in "$src"/*; do
    local base
    base="$(basename "$item")"
    if [[ "$base" == ".git" ]]; then
      echo "    SKIP .git inside source (use git subtree/submodule workflows separately)"
      continue
    fi
    if [[ -e "$dest/$base" && "$base" == "README.md" && -n "$tmp_readme" ]]; then
      echo "    KEEP institutional README.md; source README.md -> README.source.md"
      run mv "$item" "$dest/README.source.md"
      continue
    fi
    echo "    MOVE $base"
    run mv "$item" "$dest/"
  done
  shopt -u dotglob nullglob

  if [[ -n "$tmp_readme" ]]; then
    run cp "$tmp_readme" "$dest/README.md"
    rm -f "$tmp_readme"
  fi

  echo "    DONE $label import"
  echo "    Reminder: remove empty source directory manually after verification: $src"
}

import_engine "Monero_Engine" "$MONERO_SRC" "plugins/cpu/monero"
echo
import_engine "Flux_Engine" "$FLUX_SRC" "plugins/gpu/flux"
echo

echo "==> Structure check (required plugin slots + PCR)"
for path in \
  plugins/cpu/monero \
  plugins/gpu/flux \
  plugins/asic \
  core/capability_registry
do
  if [[ -d "$path" ]]; then
    echo "    PASS $path"
  else
    echo "    FAIL $path"
    exit 1
  fi
done
echo

echo "==> Bootstrap complete"
echo "    Next:"
echo "      1. Confirm plugin ownership docs remain under plugins/*/*/README.md"
echo "      2. Do not implement features until a later approved phase spec"
echo "      3. Open this repo in Cursor Desktop on this PC for continued local work"
echo
