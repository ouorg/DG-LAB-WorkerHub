#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WRANGLER_BIN="${WRANGLER_BIN:-$ROOT_DIR/node_modules/.bin/wrangler}"
WRANGLER_CONFIG_FILE="${WRANGLER_CONFIG_FILE:-$ROOT_DIR/.wrangler-ci.toml}"
WRANGLER_SECRETS_FILE="${WRANGLER_SECRETS_FILE:-$ROOT_DIR/.wrangler-ci-secrets.json}"
BUILD_DIR="${BUILD_DIR:-$ROOT_DIR/dist/worker-upload}"
D1_DATABASE_NAME="${D1_DATABASE_NAME:-dg-lab-worker-hub}"
DEPLOY_DRY_RUN="${DEPLOY_DRY_RUN:-0}"
KEEP_DEPLOY_FILES="${KEEP_DEPLOY_FILES:-0}"

export WRANGLER_CONFIG_FILE WRANGLER_SECRETS_FILE D1_DATABASE_NAME

cleanup() {
  if [[ "$KEEP_DEPLOY_FILES" != 1 ]]; then rm -f "$WRANGLER_CONFIG_FILE" "$WRANGLER_SECRETS_FILE"; fi
}
trap cleanup EXIT

phase() { printf '\n==> %s\n' "$1"; }
wrangler() { "$WRANGLER_BIN" "$@"; }

if [[ ! -x "$WRANGLER_BIN" ]]; then
  echo "Wrangler executable not found: $WRANGLER_BIN. Run npm ci first." >&2
  exit 1
fi

phase "Generate production Wrangler configuration"
./scripts/prepare-ci-config.sh

phase "Validate declared Worker bindings and variables"
./scripts/validate-deploy-config.sh "$WRANGLER_CONFIG_FILE" "$WRANGLER_SECRETS_FILE"

if [[ "$DEPLOY_DRY_RUN" != 1 ]]; then
  : "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required for remote deployment}"
  : "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required for remote deployment}"

  phase "Apply remote D1 migrations and initialize bootstrap data"
  wrangler d1 migrations apply "$D1_DATABASE_NAME" --remote --config "$WRANGLER_CONFIG_FILE"

  phase "Verify remote D1 bootstrap data"
  wrangler d1 execute "$D1_DATABASE_NAME" --remote --yes --json --config "$WRANGLER_CONFIG_FILE" \
    --command "SELECT CASE WHEN EXISTS (SELECT 1 FROM settings WHERE key = 'bootstrap.completed' AND value = 'true') THEN 1 ELSE 0 END AS bootstrap_completed, (SELECT COUNT(*) FROM settings) AS settings_count, (SELECT COUNT(*) FROM users WHERE id = 'bootstrap' AND role = 'admin') AS admin_count;" \
    | node ./scripts/verify-bootstrap.mjs
else
  phase "Skip remote D1 migration in DEPLOY_DRY_RUN mode"
fi

phase "Build deployable Worker bundle"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
wrangler deploy --dry-run --strict --outdir "$BUILD_DIR" --config "$WRANGLER_CONFIG_FILE" --secrets-file "$WRANGLER_SECRETS_FILE"
test -s "$BUILD_DIR/worker.js"
echo "built Worker bundle: $BUILD_DIR/worker.js"

if [[ "$DEPLOY_DRY_RUN" == 1 ]]; then
  phase "Deployment dry-run completed without uploading"
  exit 0
fi

phase "Upload the prebuilt Worker bundle and bind variables"
wrangler deploy "$BUILD_DIR/worker.js" --no-bundle --strict --config "$WRANGLER_CONFIG_FILE" --secrets-file "$WRANGLER_SECRETS_FILE"

phase "Worker deployment completed"
