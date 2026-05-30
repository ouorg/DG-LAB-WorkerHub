#!/usr/bin/env bash
set -euo pipefail

: "${LOGIN_PASSWORD:?LOGIN_PASSWORD repository secret is required}"
: "${HUB_KV_NAMESPACE_ID:?HUB_KV_NAMESPACE_ID repository secret is required}"

WORKER_NAME="${WORKER_NAME:-dg-lab-worker-hub}"
HUB_KV_PREVIEW_NAMESPACE_ID="${HUB_KV_PREVIEW_NAMESPACE_ID:-$HUB_KV_NAMESPACE_ID}"
SESSION_TTL_SECONDS="${SESSION_TTL_SECONDS:-86400}"

if [[ ! "$WORKER_NAME" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then
  echo "WORKER_NAME must contain only lowercase letters, digits, and hyphens" >&2
  exit 1
fi
if [[ ! "$HUB_KV_NAMESPACE_ID" =~ ^[[:xdigit:]]{32}$ ]]; then
  echo "HUB_KV_NAMESPACE_ID must be a 32-character hexadecimal KV namespace ID" >&2
  exit 1
fi
if [[ ! "$HUB_KV_PREVIEW_NAMESPACE_ID" =~ ^[[:xdigit:]]{32}$ ]]; then
  echo "HUB_KV_PREVIEW_NAMESPACE_ID must be a 32-character hexadecimal KV namespace ID" >&2
  exit 1
fi
if [[ ! "$SESSION_TTL_SECONDS" =~ ^[0-9]+$ ]] || (( SESSION_TTL_SECONDS < 300 )); then
  echo "SESSION_TTL_SECONDS must be an integer greater than or equal to 300" >&2
  exit 1
fi

escape_json_string() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"
}

cat > .wrangler-ci.toml <<EOF_CONFIG
name = "$WORKER_NAME"
main = "src/worker.ts"
compatibility_date = "2026-05-30"

[vars]
SESSION_TTL_SECONDS = "$SESSION_TTL_SECONDS"

[secrets]
required = ["LOGIN_PASSWORD"]

[[kv_namespaces]]
binding = "HUB_KV"
id = "$HUB_KV_NAMESPACE_ID"
preview_id = "$HUB_KV_PREVIEW_NAMESPACE_ID"

[[durable_objects.bindings]]
name = "DEVICE_DO"
class_name = "DeviceDurableObject"

[[durable_objects.bindings]]
name = "SOCKET_V2_DO"
class_name = "SocketV2DurableObject"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["DeviceDurableObject"]

[[migrations]]
tag = "v2"
new_sqlite_classes = ["SocketV2DurableObject"]
EOF_CONFIG

printf '{"LOGIN_PASSWORD":%s}\n' "$(escape_json_string "$LOGIN_PASSWORD")" > .wrangler-ci-secrets.json
chmod 600 .wrangler-ci.toml .wrangler-ci-secrets.json
