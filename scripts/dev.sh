#!/usr/bin/env bash
# Start the local dev stack: Ollama (service dependency), backend, and frontend.
# Usage: ./scripts/dev.sh
# Stop everything with Ctrl-C.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OLLAMA_URL="http://127.0.0.1:11434"
MODEL="${OLLAMA_MODEL:-gemma4:e4b}"

log() { printf '\033[1;36m[dev]\033[0m %s\n' "$*"; }

PIDS=()
cleanup() {
  log "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# --- 1. Ollama ---------------------------------------------------------------
if curl -sf "$OLLAMA_URL/api/version" >/dev/null 2>&1; then
  log "Ollama already running at $OLLAMA_URL"
else
  if ! command -v ollama >/dev/null 2>&1; then
    log "ERROR: ollama is not installed and no instance is reachable at $OLLAMA_URL"
    log "Install it (brew install ollama) or set SKIP_OLLAMA_CHECK=1 in backend/.env"
    exit 1
  fi
  log "Starting ollama serve..."
  ollama serve >/tmp/taxalia-ollama.log 2>&1 &
  PIDS+=($!)
  for _ in $(seq 1 30); do
    curl -sf "$OLLAMA_URL/api/version" >/dev/null 2>&1 && break
    sleep 1
  done
  curl -sf "$OLLAMA_URL/api/version" >/dev/null 2>&1 || {
    log "ERROR: Ollama did not come up. See /tmp/taxalia-ollama.log"
    exit 1
  }
  log "Ollama is up"
fi

if ! curl -sf "$OLLAMA_URL/api/tags" | grep -q "\"$MODEL\""; then
  log "WARNING: model '$MODEL' not found locally. Chat will fail until you run: ollama pull $MODEL"
fi

free_port() {
  local port="$1"
  local pids
  pids="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [ -z "$pids" ] && return 0
  log "Port $port in use by PID(s) $pids — killing..."
  kill $pids 2>/dev/null || true
  for _ in $(seq 1 10); do
    lsof -nP -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || return 0
    sleep 1
  done
  log "PID(s) still alive on port $port — sending SIGKILL"
  kill -9 $pids 2>/dev/null || true
  sleep 1
}

# --- 2. Backend (port 4324) --------------------------------------------------
free_port 4324
log "Starting backend (npm run dev)..."
(cd "$ROOT/backend" && npm run dev) &
PIDS+=($!)

# --- 3. Frontend (port 4321) -------------------------------------------------
free_port 4321
log "Starting frontend (npm run dev)..."
(cd "$ROOT/frontend" && npm run dev) &
PIDS+=($!)

log "Stack running: backend http://localhost:4324 | frontend http://localhost:4321"
log "Press Ctrl-C to stop everything."
wait
