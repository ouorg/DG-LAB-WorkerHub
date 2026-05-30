# DG-LAB WorkerHub

基于 Cloudflare Workers 免费方案可用能力构建的 DG-LAB 云端控制台。项目使用 Durable Objects 保存实时设备状态，D1 保存结构化主数据，KV 保存短期会话、限流计数和可重建缓存，R2 保存波形模板与归档对象。

## 功能特性

- 密码登录、短期会话、设备归属校验，以及首次登录自动创建并选择默认设备。
- DG-LAB 强度、波形、通道清空、状态反馈和心跳协议处理。
- DG-LAB SOCKET v2 兼容的公开 WebSocket Hub，可供第三方控制端与 APP 配对。
- REST API、MCP 风格工具接口和响应式网页控制台。
- D1 migration、运行时幂等 bootstrap、CI 自动迁移与部署。

## 存储分层

| 绑定 | Cloudflare 产品 | 用途 | 是否为实时状态主路径 |
| --- | --- | --- | --- |
| `DEVICE_DO` / `SOCKET_V2_DO` | Durable Objects | 设备实时状态、WebSocket、指令队列、SOCKET v2 配对 | 是 |
| `DB` | D1 | 用户、设备、绑定关系、登录会话索引、审计热日志、波形模板元信息、settings | 否 |
| `HUB_KV` | Workers KV | 短期登录 token、临时票据、分钟级限流计数，以及设备状态与绑定摘要 | 否，可过期并重建 |
| `ASSETS_BUCKET` | R2 | 波形模板、大对象、导出文件 | 否 |
| `ARCHIVE_BUCKET` | R2 | 冷审计日志与设备状态归档 | 否 |

实时状态不会写入 KV 或 D1 作为主路径。Worker 在读取状态或执行控制命令后，只会向 `HUB_KV` 写入带 TTL 的可丢失摘要。设备秒级命令限流继续由 Durable Object 执行；KV 仅用于 TTL 不低于 60 秒的低频限流窗口。 `HUB_KV` 使用 `session:`、`rl:`、`device:state:` 和 `device:binding:` 前缀隔离不同用途，无需为每类临时数据单独创建 namespace。

## 代码组织

核心运行时代码按职责拆分：

| 路径 | 职责 |
| --- | --- |
| `src/worker.ts` | 顶层路由编排和统一错误响应 |
| `src/core/auth.ts` | 密码校验、登录限流和 Bearer 会话解析 |
| `src/core/device-service.ts` | Durable Object 调用、设备归属校验、绑定与控制服务 |
| `src/core/mcp.ts` | MCP 工具定义和分发 |
| `src/core/config.ts` | 默认配置、TTL 和统一 `HUB_KV` key 前缀 |
| `src/core/store.ts` | D1 主数据与 KV 短期数据访问 |
| `src/storage/bootstrap.ts` | 幂等 bootstrap 基础数据写入 |
| `src/storage/kv.ts` | KV JSON 和低频窗口 helper |
| `src/storage/r2.ts` | R2 对象 key 和上传 helper |
| `src/storage/sql.ts` | 集中的 D1 查询语句，便于审阅 schema 相关改动 |
| `src/ui/{console,styles,client}.ts` | 控制台 HTML、样式与浏览器交互脚本 |

新增业务时优先扩展对应模块，避免把数据库、协议和 HTTP 细节继续堆叠到 `src/worker.ts`。

## D1 schema 与 bootstrap

D1 schema 位于 `migrations/0001_init.sql`。它包含：

- `users`
- `devices`
- `device_bindings`
- `sessions`
- `audit_logs`
- `waveform_templates`
- `settings`

部署前必须先应用 migration。生产部署工作流会在发布 Worker 前自动执行：

```sh
npx wrangler d1 migrations apply DB --remote
```

Worker 第一次访问健康检查或需要 D1 的业务接口时，会幂等写入默认 settings 和默认管理员。schema 变更仍由 migration 管理，不会在普通请求中隐式执行 DDL。

默认 settings 包含：

- `bootstrap.completed = true`
- `app.name = DG-LAB Cloud Console`
- `security.max_strength_step = 10`
- `security.max_message_length = 1950`
- `security.session_ttl_minutes = 30`
- `security.qr_ttl_seconds = 180`
- `audit.hot_retention_days = 7`
- `audit.archive_enabled = true`

## 本地开发

### 1. 安装依赖

```sh
npm install
```

### 2. 配置本地密码

创建不会提交到仓库的 `.dev.vars`：

```dotenv
LOGIN_PASSWORD="replace-me"
```

### 3. 应用本地 D1 migration

```sh
npm run db:migrate:local
```

### 4. 启动 Worker

```sh
npm run dev
```

Wrangler 本地模式会为 D1、KV 和 R2 建立持久化的本地资源。

## Cloudflare 资源创建

首次部署前创建一个 D1 数据库、一个 KV namespace 和两个 R2 bucket：

```sh
npx wrangler d1 create dg-lab-worker-hub
npx wrangler kv namespace create HUB_KV
npx wrangler r2 bucket create dg-lab-assets
npx wrangler r2 bucket create dg-lab-archive
```

将返回的资源 ID 配置为 Repository Secrets，再触发 GitHub Actions 部署。

## GitHub Actions 自动部署

仓库中的 `.github/workflows/deploy-worker.yml` 会生成临时 Wrangler 配置、应用 D1 migrations、部署 Worker，并在结束后删除临时配置和 secrets 文件。

### 必填 Repository Secrets

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare 部署与资源访问凭据 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `LOGIN_PASSWORD` | 控制台登录密码，作为 Worker secret 上传 |
| `D1_DATABASE_ID` | D1 数据库 UUID |
| `HUB_KV_NAMESPACE_ID` | 统一 KV namespace ID |

### 可选 Repository Secrets

| Secret | 默认值 | 用途 |
| --- | --- | --- |
| `D1_DATABASE_NAME` | `dg-lab-worker-hub` | D1 数据库名称 |
| `HUB_KV_PREVIEW_NAMESPACE_ID` | 回退到生产 ID | 统一 KV preview ID |
| `ASSETS_BUCKET_NAME` | `dg-lab-assets` | R2 资源 bucket |
| `ARCHIVE_BUCKET_NAME` | `dg-lab-archive` | R2 归档 bucket |
| `SESSION_TTL_SECONDS` | `1800` | 登录会话 TTL，最小值为 300 秒 |
| `WORKER_NAME` | `dg-lab-worker-hub` | Worker 服务名称 |

## API 概览

- `GET /api/health`：执行幂等 bootstrap 并返回存储层健康信息。
- `POST /api/auth/login`：请求体为 `{ "password": "..." }`。登录成功后返回短期会话与可直接使用的默认设备。
- `GET|POST /api/devices`
- `GET /api/devices/:id/status`
- `GET /api/devices/:id/logs`
- `POST /api/devices/:id/{bind,unbind,strength,waveform,clear}`
- `GET /api/devices/:id/connect?token=...`：设备 APP WebSocket 接口。
- `GET /api/mcp/tools`
- `POST /api/mcp/tool/{list_devices,get_device_status,set_strength,send_waveform,clear_channel,bind_device,unbind_device}`

## DG-LAB SOCKET v2 兼容接口

该公开 WebSocket Hub 面向郊狼脉冲主机 3.0 APP SOCKET 功能，与需要登录的管理 API 相互独立：

1. 第三方控制端连接 `wss://<你的域名>/socket`，服务端返回 `type: "bind"` 消息并分配 UUID v4 `clientId`。
2. 控制端生成二维码：`https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#wss://<你的域名>/<clientId>`。
3. APP 扫码连接二维码地址，服务端分配 `targetId`；APP 再发送 `type: "bind"` 完成配对。
4. 配对后，控制端可发送 v2 的 `type: 1`、`2`、`3`、`4` 和 `clientMsg` 消息。

Hub 会拒绝超过 1950 字符的 JSON 消息；单次波形数组最多包含 100 条 8 字节 HEX 数据。`clientMsg.time` 默认为 5 秒，允许范围为 1 到 60 秒。可选 Worker 变量 `SOCKET_PULSE_INTERVAL_MS` 用于调整波形重复发送间隔，`HEARTBEAT_INTERVAL` 用于调整心跳间隔。
