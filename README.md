# DG-LAB WorkerHub

基于 Cloudflare Workers 的 DG-LAB 设备控制中心。项目使用 Workers KV 保存短期会话、设备元数据和保留 30 天的审计记录，并为每台设备分配一个 Durable Object 实例进行实时协调。

## 功能特性

- 支持 token 登录、会话过期控制和设备归属校验。
- 支持 DG-LAB 强度、波形、通道清空、状态反馈和心跳协议处理。
- 支持绑定校验、强度上下限保护、消息长度限制、严格波形校验和按设备限流。
- 提供 REST API 和 MCP 风格工具接口，用于控制设备。
- 内置网页控制台，可用于登录、设备管理、控制、日志查看和 MCP 工具测试。

## 本地配置

```sh
npm install
npx wrangler kv namespace create HUB_KV
npx wrangler kv namespace create HUB_KV --preview
```

将命令返回的 ID 填入 `wrangler.toml`，然后添加 Wrangler 密钥 `BOOTSTRAP_TOKEN`：

```sh
npx wrangler secret put BOOTSTRAP_TOKEN
npm run dev
```

可选：将 `SESSION_TTL_SECONDS` 设置为 Wrangler 变量。会话有效期默认为 24 小时，且不能短于 5 分钟。

## API 概览

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

```dotenv
BOOTSTRAP_TOKEN="replace-me"
```
