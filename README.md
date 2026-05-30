# DG-LAB WorkerHub

A Cloudflare Workers control hub for DG-LAB devices. It uses Workers KV for short-lived sessions, device metadata, and 30-day audit records, plus one Durable Object per device for real-time coordination.

## Features

- Token login with expiring sessions and per-device ownership checks.
- DG-LAB strength, waveform, channel-clear, feedback, and heartbeat protocol handling.
- Binding enforcement, strength bounds, message-length checks, strict waveform validation, and per-device command rate limits.
- REST APIs and MCP-style tool endpoints for device control.
- Built-in browser console for login, device management, control, logs, and MCP tool testing.

## Setup

```sh
npm install
npx wrangler kv namespace create HUB_KV
npx wrangler kv namespace create HUB_KV --preview
```

Copy the returned IDs into `wrangler.toml`, then add `BOOTSTRAP_TOKEN` as a Wrangler secret:

```sh
npx wrangler secret put BOOTSTRAP_TOKEN
npm run dev
```

Optional: set `SESSION_TTL_SECONDS` as a Wrangler variable. Sessions default to 24 hours and are never shorter than 5 minutes.

## API summary

- `POST /api/auth/login`
- `GET|POST /api/devices`
- `GET /api/devices/:id/status`
- `GET /api/devices/:id/logs`
- `POST /api/devices/:id/{bind,unbind,strength,waveform,clear}`
- `GET /api/devices/:id/connect?token=...` (WebSocket endpoint for the device APP)
- `GET /api/mcp/tools`
- `POST /api/mcp/tool/{list_devices,get_device_status,set_strength,send_waveform,clear_channel,bind_device,unbind_device}`

## GitHub Actions deployment

The repository includes `.github/workflows/deploy-worker.yml`. A push to `main`, or a manual `workflow_dispatch` run, generates a temporary Wrangler configuration from GitHub Repository Secrets and deploys the Worker with `cloudflare/wrangler-action`. Runtime secrets are uploaded alongside the Worker version through Wrangler's `--secrets-file` option. The generated configuration and secret file are removed after every run and ignored by Git.

Configure these Repository Secrets before running the workflow:

| Secret | Required | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token authorized to deploy Workers and use the configured KV namespace. |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account containing the Worker and KV namespace. |
| `BOOTSTRAP_TOKEN` | Yes | Runtime secret used by `POST /api/auth/login`. It is uploaded as an encrypted Worker secret. |
| `HUB_KV_NAMESPACE_ID` | Yes | Production KV namespace ID bound as `HUB_KV`. |
| `HUB_KV_PREVIEW_NAMESPACE_ID` | No | Preview KV namespace ID. It falls back to `HUB_KV_NAMESPACE_ID` when omitted. |
| `SESSION_TTL_SECONDS` | No | Session lifetime. It defaults to `86400` seconds and must be at least `300`. |
| `WORKER_NAME` | No | Worker service name. It defaults to `dg-lab-worker-hub`. |

`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` authenticate Wrangler itself and are passed directly to the GitHub Action. Application configuration is written only to temporary ignored files by `scripts/prepare-ci-config.sh`; production IDs and tokens do not need to be committed to `wrangler.toml`.

For local development, keep using an uncommitted `.dev.vars` file:

```dotenv
BOOTSTRAP_TOKEN="replace-me"
```
