#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${1:-${WRANGLER_CONFIG_FILE:-.wrangler-ci.toml}}"
SECRETS_FILE="${2:-${WRANGLER_SECRETS_FILE:-.wrangler-ci-secrets.json}}"

if [[ ! -s "$CONFIG_FILE" ]]; then
  echo "deployment config does not exist or is empty: $CONFIG_FILE" >&2
  exit 1
fi

require_line() {
  local pattern="$1"
  if ! grep -Eq "$pattern" "$CONFIG_FILE"; then
    echo "deployment config is missing required entry: $pattern" >&2
    exit 1
  fi
}

require_line '^main = "src/worker.ts"$'
require_line '^SESSION_TTL_SECONDS = "[0-9]+"$'
require_line '^SOCKET_PULSE_INTERVAL_MS = "[0-9]+"$'
require_line '^HEARTBEAT_INTERVAL = "[0-9]+"$'
require_line '^required = \["LOGIN_PASSWORD"\]$'
require_line '^binding = "DB"$'
require_line '^migrations_dir = "migrations"$'
require_line '^binding = "HUB_KV"$'
require_line '^binding = "ASSETS_BUCKET"$'
require_line '^binding = "ARCHIVE_BUCKET"$'
require_line '^name = "DEVICE_DO"$'
require_line '^class_name = "DeviceDurableObject"$'
require_line '^name = "SOCKET_V2_DO"$'
require_line '^class_name = "SocketV2DurableObject"$'

if [[ "$(grep -c '^\[\[d1_databases\]\]$' "$CONFIG_FILE")" != 1 ]]; then
  echo "deployment config must contain exactly one D1 binding" >&2
  exit 1
fi
if [[ "$(grep -c '^\[\[kv_namespaces\]\]$' "$CONFIG_FILE")" != 1 ]]; then
  echo "deployment config must contain exactly one KV binding" >&2
  exit 1
fi
if [[ "$(grep -c '^\[\[r2_buckets\]\]$' "$CONFIG_FILE")" != 2 ]]; then
  echo "deployment config must contain exactly two R2 bindings" >&2
  exit 1
fi
if [[ "$(grep -c '^\[\[durable_objects.bindings\]\]$' "$CONFIG_FILE")" != 2 ]]; then
  echo "deployment config must contain exactly two Durable Object bindings" >&2
  exit 1
fi

if [[ ! -s "$SECRETS_FILE" ]]; then
  echo "deployment secrets file does not exist or is empty: $SECRETS_FILE" >&2
  exit 1
fi
node -e '
  const fs = require("node:fs");
  const secrets = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (typeof secrets.LOGIN_PASSWORD !== "string" || secrets.LOGIN_PASSWORD.length === 0) {
    throw new Error("deployment secrets must contain a non-empty LOGIN_PASSWORD");
  }
' "$SECRETS_FILE"

echo "deployment bindings validated: DB, HUB_KV, ASSETS_BUCKET, ARCHIVE_BUCKET, DEVICE_DO, SOCKET_V2_DO, LOGIN_PASSWORD"
