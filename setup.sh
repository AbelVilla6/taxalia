#!/usr/bin/env bash
# Thin Unix wrapper — delegates to the cross-platform Node script.
set -euo pipefail
node "$(dirname "$0")/scripts/setup.mjs"
