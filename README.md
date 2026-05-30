# DG-LAB WorkerHub

基于 Cloudflare Workers 的 DG-LAB 设备控制中心。项目使用 Workers KV 保存短期会话、设备元数据和保留 30 天的审计记录，并为每台设备分配一个 Durable Object 实例进行实时协调。

## 功能特性

- 支持 token 登录、会话过期控制和设备归属校验。
- 支持 DG-LAB 强度、波形、通道清空、状态反馈和心跳协议处理。
- 支持绑定校验、强度上下限保护、消息长度限制、严格波形校验和按设备限流。
- 提供 REST API 和 MCP 风格工具接口，用于控制设备。
- 内置网页控制台，可用于登录、设备管理、控制、日志查看和 MCP 工具测试。

## 本地配置
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

将命令返回的 ID 填入 `wrangler.toml`，然后添加 Wrangler 密钥 `BOOTSTRAP_TOKEN`：
Copy the returned IDs into `wrangler.toml`, then add `BOOTSTRAP_TOKEN` as a Wrangler secret:

```sh
npx wrangler secret put BOOTSTRAP_TOKEN
npm run dev
```

可选：将 `SESSION_TTL_SECONDS` 设置为 Wrangler 变量。会话有效期默认为 24 小时，且不能短于 5 分钟。

## API 概览
Optional: set `SESSION_TTL_SECONDS` as a Wrangler variable. Sessions default to 24 hours and are never shorter than 5 minutes.

## API summary

- `POST /api/auth/login`
- `GET|POST /api/devices`
- `GET /api/devices/:id/status`
- `GET /api/devices/:id/logs`
- `POST /api/devices/:id/{bind,unbind,strength,waveform,clear}`
- `GET /api/devices/:id/connect?token=...`（设备 APP 使用的 WebSocket 接口）
- `GET /api/mcp/tools`
- `POST /api/mcp/tool/{list_devices,get_device_status,set_strength,send_waveform,clear_channel,bind_device,unbind_device}`

## GitHub Actions 自动部署

仓库已包含 `.github/workflows/deploy-worker.yml`。推送到 `main` 分支或手动执行 `workflow_dispatch` 时，工作流会读取 GitHub Repository Secrets，生成临时 Wrangler 配置，并通过 `cloudflare/wrangler-action` 部署 Worker。运行时密钥会通过 Wrangler 的 `--secrets-file` 参数与 Worker 版本一起上传。每次运行结束后，无论部署是否成功，临时配置和密钥文件都会被删除；这些文件也已加入 Git 忽略规则。

运行工作流前，请配置以下 Repository Secrets：

| 密钥 | 是否必填 | 用途 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | 是 | Cloudflare API token，需要具备部署 Workers 和使用已配置 KV 命名空间的权限。 |
| `CLOUDFLARE_ACCOUNT_ID` | 是 | Worker 和 KV 命名空间所属的 Cloudflare 账号 ID。 |
| `BOOTSTRAP_TOKEN` | 是 | `POST /api/auth/login` 使用的运行时密钥。部署时会将其上传为加密的 Worker secret。 |
| `HUB_KV_NAMESPACE_ID` | 是 | 绑定到 `HUB_KV` 的生产环境 KV 命名空间 ID。 |
| `HUB_KV_PREVIEW_NAMESPACE_ID` | 否 | 预览环境 KV 命名空间 ID。未配置时会回退到 `HUB_KV_NAMESPACE_ID`。 |
| `SESSION_TTL_SECONDS` | 否 | 会话有效期，默认值为 `86400` 秒，且不能小于 `300` 秒。 |
| `WORKER_NAME` | 否 | Worker 服务名称，默认值为 `dg-lab-worker-hub`。 |

`CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 用于 Wrangler 身份验证，并会直接传递给 GitHub Action。应用配置仅由 `scripts/prepare-ci-config.sh` 写入临时且已忽略的文件，因此无需将生产环境 ID 或 token 提交到 `wrangler.toml`。

本地开发时，请继续使用不会提交到仓库的 `.dev.vars` 文件：
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
