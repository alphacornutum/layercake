#!/usr/bin/env bash
set -euo pipefail

# Hooks send JSON on stdin; we do not need it for this task.
if [ ! -t 0 ]; then
  cat >/dev/null || true
fi

if ! command -v uvx >/dev/null 2>&1; then
  exit 0
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCK_DIR="$REPO_ROOT/scripts/cursor-hooks/.graph-update.lock"

# If another update is running, skip this one.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

uvx --with sentence-transformers code-review-graph update \
  --repo "$REPO_ROOT" \
  --base HEAD~1 \
  --skip-flows >/dev/null 2>&1 || true
