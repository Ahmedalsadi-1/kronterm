#!/usr/bin/env bash
# Krondesign Daemon Manager
# Usage: krondesign-manager.sh [start|stop|status|restart]
set -euo pipefail

KRONTERM_HOME="${HOME}/kronterm"
KRD_HOME="${KRONTERM_HOME}/krondesign"
KRD_PORT="${KRD_PORT:-${OD_PORT:-7456}}"
KRD_BIN="${KRD_HOME}/apps/daemon/bin/krd.mjs"
PID_FILE="/tmp/krondesign-daemon.pid"
LOG_FILE="/tmp/krondesign-daemon.log"
LAUNCH_LABEL="com.kronterm.krondesign"

# Auto-detect nvm and switch to Node 24 (required for better-sqlite3 compat)
use_correct_node() {
  if [ -f "${HOME}/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "${HOME}/.nvm/nvm.sh"
    if nvm use 24 >/dev/null 2>&1; then
      return 0
    fi
  fi
  # Check if current node is ~24
  NODE_VER=$(node --version 2>/dev/null || echo "none")
  case "$NODE_VER" in
    v24*) return 0 ;;
    *) ;;
  esac
  echo "Warning: expected Node 24, got $NODE_VER. better-sqlite3 may fail." >&2
  return 1
}

cmd_start() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    if curl -sf --max-time 2 "http://localhost:${KRD_PORT}/api/health" > /dev/null 2>&1; then
      echo "Krondesign daemon is already running (PID $(cat "$PID_FILE"))"
      return 0
    fi
    echo "Krondesign daemon PID $(cat "$PID_FILE") is unresponsive; restarting..."
    cmd_stop
  fi

  if [ ! -f "$KRD_BIN" ]; then
    echo "Error: Krondesign binary not found at $KRD_BIN"
    echo "Run 'pnpm --filter @krondesign/daemon build' in $KRD_HOME first."
    exit 1
  fi

  use_correct_node
  NODE_BIN=$(command -v node)

  echo "Starting Krondesign daemon on port $KRD_PORT..."
  rm -f "$LOG_FILE"
  cd "$KRD_HOME"
  nohup "$NODE_BIN" "$KRD_BIN" --port "$KRD_PORT" --no-open > "$LOG_FILE" 2>&1 &
  KRD_PID=$!
  echo "$KRD_PID" > "$PID_FILE"

  # Wait for health check
  PID=""
  for i in {1..15}; do
    if curl -sf "http://localhost:${KRD_PORT}/api/health" > /dev/null 2>&1; then
      PID=$(lsof -tiTCP:"$KRD_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)
      if [ -n "$PID" ]; then
        echo "$PID" > "$PID_FILE"
      fi
      echo "Krondesign daemon is ready (PID $PID) - http://localhost:${KRD_PORT}"
      return 0
    fi
    sleep 1
  done

  echo "Daemon started but health check timed out. Check $LOG_FILE for details."
  tail -5 "$LOG_FILE" 2>/dev/null || true
  return 1
}

cmd_stop() {
  if [ ! -f "$PID_FILE" ]; then
    echo "No PID file found. Daemon may not be running."
    return 0
  fi

  PID=$(cat "$PID_FILE")
  if command -v launchctl >/dev/null 2>&1; then
    launchctl remove "$LAUNCH_LABEL" >/dev/null 2>&1 || true
  fi
  if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping Krondesign daemon (PID $PID)..."
    kill "$PID" 2>/dev/null || true
    for i in {1..5}; do
      if ! kill -0 "$PID" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    kill -9 "$PID" 2>/dev/null || true
    echo "Daemon stopped."
  else
    echo "Daemon not running (stale PID file)."
  fi
  rm -f "$PID_FILE"
}

cmd_status() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    PID=$(cat "$PID_FILE")
    echo "Krondesign daemon is running:"
    echo "  PID:        $PID"
    echo "  URL:        http://localhost:${KRD_PORT}"
    echo "  Log:        $LOG_FILE"
    if curl -sf "http://localhost:${KRD_PORT}/api/health" > /dev/null 2>&1; then
      echo "  Health:     OK"
    else
      echo "  Health:     UNKNOWN (check log)"
    fi
  else
    echo "Krondesign daemon is NOT running."
  fi
}

case "${1:-status}" in
  start)
    cmd_start
    ;;
  stop)
    cmd_stop
    ;;
  status)
    cmd_status
    ;;
  restart)
    cmd_stop
    sleep 1
    cmd_start
    ;;
  *)
    echo "Usage: $0 [start|stop|status|restart]"
    exit 1
    ;;
esac
