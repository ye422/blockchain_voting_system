#!/usr/bin/env bash
# Shared helpers for managing the ngrok RPC tunnel and updating .env.

# shellcheck disable=SC2034

if [[ -z "${PROJECT_ROOT:-}" ]]; then
  PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

NGROK_TUNNEL_STATE_FILE="${NGROK_TUNNEL_STATE_FILE:-${PROJECT_ROOT}/.ngrok-tunnel}"
NGROK_DEFAULT_PORT="${NGROK_DEFAULT_PORT:-9545}"
NGROK_LOCAL_RPC_URL="http://localhost:${NGROK_DEFAULT_PORT}"

_ngrok_escape_value() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

_ngrok_require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "This operation requires '$1' but it is not available in PATH." >&2
    return 1
  fi
}

_ngrok_read_state() {
  if [[ -f "${NGROK_TUNNEL_STATE_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${NGROK_TUNNEL_STATE_FILE}"
    return 0
  fi
  return 1
}

ngrok_update_root_rpc_url() {
  local new_value="$1"
  local env_file="${PROJECT_ROOT}/.env"
  local quoted="\"${new_value}\""
  mkdir -p "$(dirname "${env_file}")"
  [[ -f "${env_file}" ]] || touch "${env_file}"

  local escaped
  escaped=$(_ngrok_escape_value "${quoted}")
  if grep -q "^RPC_URL=" "${env_file}" >/dev/null 2>&1; then
    sed -i "s|^RPC_URL=.*$|RPC_URL=${escaped}|" "${env_file}"
  else
    printf "RPC_URL=%s\n" "${quoted}" >> "${env_file}"
  fi
  echo "✓ Updated ${env_file} RPC_URL → ${new_value}"
}

ngrok_start_rpc_tunnel() {
  local port="${1:-$NGROK_DEFAULT_PORT}"
  _ngrok_require_command ngrok || return 1
  _ngrok_require_command openssl || return 1
  _ngrok_require_command curl || return 1
  _ngrok_require_command python3 || return 1

  if _ngrok_read_state && [[ -n "${NGROK_PID:-}" ]] && kill -0 "${NGROK_PID}" 2>/dev/null; then
    echo "${NGROK_RPC_URL}"
    return 0
  fi

  local username="rpc$(openssl rand -hex 4)"
  local password
  password="$(openssl rand -hex 16)"
  local log_file="${PROJECT_ROOT}/ngrok-${port}.log"

  nohup ngrok http "${port}" \
    --basic-auth="${username}:${password}" \
    --host-header="localhost:${port}" \
    --log=stdout > "${log_file}" 2>&1 &
  local ngrok_pid=$!
  disown "${ngrok_pid}" >/dev/null 2>&1 || true

  local public_url=""
  local attempt
  for attempt in $(seq 1 30); do
    if [[ -f "${log_file}" ]]; then
      public_url="$(grep -o 'url=https://[^ ]*' "${log_file}" | tail -n1 | cut -d= -f2)"
      if [[ -n "${public_url}" ]]; then
        break
      fi
    fi
    public_url="$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 - <<'PY' 2>/dev/null
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for tunnel in data.get("tunnels", []):
    url = tunnel.get("public_url", "")
    if url.startswith("https://"):
        print(url)
        sys.exit(0)
PY
)"
    if [[ -n "${public_url}" ]]; then
      break
    fi
    sleep 1
  done

  if [[ -z "${public_url}" ]]; then
    echo "✗ Failed to obtain ngrok public URL. See ${log_file} for details." >&2
    kill "${ngrok_pid}" >/dev/null 2>&1 || true
    return 1
  fi

  local rpc_url="https://${username}:${password}@${public_url#https://}"
  cat > "${NGROK_TUNNEL_STATE_FILE}" <<EOF
NGROK_PID=${ngrok_pid}
NGROK_PORT=${port}
NGROK_PUBLIC_URL=${public_url}
NGROK_RPC_URL=${rpc_url}
NGROK_USERNAME=${username}
NGROK_PASSWORD=${password}
NGROK_LOG_FILE=${log_file}
NGROK_CREATED_AT=$(date -u +%s)
EOF

  echo "${rpc_url}"
}

ngrok_stop_rpc_tunnel() {
  if ! _ngrok_read_state; then
    echo "No ngrok tunnel state file found (${NGROK_TUNNEL_STATE_FILE})."
    return 0
  fi

  if [[ -n "${NGROK_PID:-}" ]] && kill -0 "${NGROK_PID}" 2>/dev/null; then
    kill "${NGROK_PID}" >/dev/null 2>&1 || true
    wait "${NGROK_PID}" >/dev/null 2>&1 || true
  fi

  rm -f "${NGROK_TUNNEL_STATE_FILE}"
  echo "✓ Stopped ngrok tunnel"
}
