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
