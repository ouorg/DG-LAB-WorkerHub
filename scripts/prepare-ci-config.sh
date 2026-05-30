#!/usr/bin/env bash
set -euo pipefail

: "${LOGIN_PASSWORD:?LOGIN_PASSWORD repository secret is required}"
: "${D1_DATABASE_ID:?D1_DATABASE_ID repository secret is required}"
: "${HUB_KV_NAMESPACE_ID:?HUB_KV_NAMESPACE_ID repository secret is required}"

WORKER_NAME="${WORKER_NAME:-dg-lab-worker-hub}"
D1_DATABASE_NAME="${D1_DATABASE_NAME:-dg-lab-worker-hub}"
HUB_KV_PREVIEW_NAMESPACE_ID="${HUB_KV_PREVIEW_NAMESPACE_ID:-$HUB_KV_NAMESPACE_ID}"
ASSETS_BUCKET_NAME="${ASSETS_BUCKET_NAME:-dg-lab-assets}"
ARCHIVE_BUCKET_NAME="${ARCHIVE_BUCKET_NAME:-dg-lab-archive}"
SESSION_TTL_SECONDS="${SESSION_TTL_SECONDS:-1800}"

if [[ ! "$WORKER_NAME" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then echo "WORKER_NAME must contain only lowercase letters, digits, and hyphens" >&2; exit 1; fi
if [[ ! "$D1_DATABASE_NAME" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then echo "D1_DATABASE_NAME must contain only lowercase letters, digits, and hyphens" >&2; exit 1; fi
if [[ ! "$D1_DATABASE_ID" =~ ^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}$ ]]; then echo "D1_DATABASE_ID must be a UUID" >&2; exit 1; fi
for name in HUB_KV_NAMESPACE_ID HUB_KV_PREVIEW_NAMESPACE_ID; do
  if [[ ! "${!name}" =~ ^[[:xdigit:]]{32}$ ]]; then echo "$name must be a 32-character hexadecimal KV namespace ID" >&2; exit 1; fi
done
for name in ASSETS_BUCKET_NAME ARCHIVE_BUCKET_NAME; do
  if [[ ! "${!name}" =~ ^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$ ]]; then echo "$name must be a valid lowercase R2 bucket name" >&2; exit 1; fi
done
if [[ ! "$SESSION_TTL_SECONDS" =~ ^[0-9]+$ ]] || (( SESSION_TTL_SECONDS < 300 )); then echo "SESSION_TTL_SECONDS must be an integer greater than or equal to 300" >&2; exit 1; fi

escape_json_string() { node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"; }

cat > .wrangler-ci.toml <<EOF_CONFIG
name = "$WORKER_NAME"
main = "src/worker.ts"
compatibility_date = "2026-05-30"

[vars]
SESSION_TTL_SECONDS = "$SESSION_TTL_SECONDS"

[secrets]
required = ["LOGIN_PASSWORD"]

[[d1_databases]]
binding = "DB"
database_name = "$D1_DATABASE_NAME"
database_id = "$D1_DATABASE_ID"
migrations_dir = "migrations"

[[kv_namespaces]]
binding = "HUB_KV"
id = "$HUB_KV_NAMESPACE_ID"
preview_id = "$HUB_KV_PREVIEW_NAMESPACE_ID"

[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "$ASSETS_BUCKET_NAME"

[[r2_buckets]]
binding = "ARCHIVE_BUCKET"
bucket_name = "$ARCHIVE_BUCKET_NAME"

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
