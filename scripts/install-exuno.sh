#!/usr/bin/env bash
# Install the Exuno CLI version pinned in .ai/exuno.yaml.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXUNO_VERSION="$(sed -n 's/^exuno_version: "\([^"]*\)"$/\1/p' "$REPO_ROOT/.ai/exuno.yaml")"
INSTALL_URL="https://raw.githubusercontent.com/yelmuratoff/exuno/main/install.sh"

if [[ -z "$EXUNO_VERSION" ]]; then
  echo "error: could not read exuno_version from .ai/exuno.yaml" >&2
  exit 1
fi

export EXUNO_VERSION
export PATH="${HOME}/.local/bin:${PATH}"
if [[ -n "${GITHUB_PATH:-}" ]]; then
  echo "${HOME}/.local/bin" >> "$GITHUB_PATH"
fi

curl -fsSL "$INSTALL_URL" | bash

if ! command -v exuno >/dev/null 2>&1; then
  echo "error: exuno not found on PATH after install" >&2
  exit 1
fi

installed_version="$(exuno --version 2>/dev/null | head -n1 | tr -d '[:space:]')"
case "$installed_version" in
  *"${EXUNO_VERSION}"*) ;;
  *)
    echo "error: expected exuno v${EXUNO_VERSION}, got ${installed_version:-unknown}" >&2
    exit 1
    ;;
esac

echo "[install-exuno] installed ${installed_version}"
