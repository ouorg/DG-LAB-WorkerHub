# DG-LAB WorkerHub

基于 Cloudflare Workers 免费方案可用能力构建的 DG-LAB 云端控制台。项目使用 Durable Objects 保存实时设备状态，D1 保存结构化主数据，KV 保存短期会话、限流计数和可重建缓存，R2 保存波形模板与归档对象。

## 推荐部署方式：GitHub Actions

仓库已内置 `.github/workflows/deploy-worker.yml`，并将生产发布流程统一收敛到 `scripts/deploy-worker.sh`。推荐优先使用 GitHub Actions 部署，不需要手动维护生产环境 `wrangler.toml`：脚本会根据 Repository Secrets 生成临时 Wrangler 配置，检查 D1、单一 KV、R2、Durable Objects 和登录密码绑定，应用 D1 migrations 并验证初始化数据，构建可部署 bundle，最后将已经构建好的 bundle 推送到 Workers。Actions 同一时间只会执行一个生产部署，避免并发 migration 与发布互相干扰。

### 1. Fork 或复制仓库

将仓库放入自己的 GitHub 账号或组织，并确认默认分支为 `main`。

### 2. 创建 Cloudflare 资源

只需创建一个 D1 数据库、一个 KV namespace 和两个 R2 bucket：

```sh
npx wrangler login
npx wrangler d1 create dg-lab-worker-hub
npx wrangler kv namespace create HUB_KV
npx wrangler r2 bucket create dg-lab-assets
npx wrangler r2 bucket create dg-lab-archive
```

保存命令返回的 D1 数据库 UUID 和 KV namespace ID。R2 bucket 默认名称已经写入部署脚本；只有使用其他名称时才需要额外配置。

### 3. 配置 GitHub Repository Secrets

进入仓库的 **Settings → Secrets and variables → Actions → Repository secrets**，添加以下必填项：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token，需要具备 Workers、D1、KV 和 R2 的部署访问权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `LOGIN_PASSWORD` | 云端控制台登录密码；部署时作为 Worker secret 上传 |
| `D1_DATABASE_ID` | `npx wrangler d1 create` 返回的数据库 UUID |
| `HUB_KV_NAMESPACE_ID` | `npx wrangler kv namespace create` 返回的 namespace ID |

以下配置可选；未设置时部署脚本会使用默认值：

| Secret | 默认值 | 用途 |
| --- | --- | --- |
| `D1_DATABASE_NAME` | `dg-lab-worker-hub` | D1 数据库名称 |
| `HUB_KV_PREVIEW_NAMESPACE_ID` | 回退到生产 ID | KV preview namespace ID |
| `ASSETS_BUCKET_NAME` | `dg-lab-assets` | R2 波形与导出资源 bucket |
| `ARCHIVE_BUCKET_NAME` | `dg-lab-archive` | R2 冷日志归档 bucket |
| `SESSION_TTL_SECONDS` | `1800` | 登录会话 TTL，最小值为 300 秒 |
| `SOCKET_PULSE_INTERVAL_MS` | `1000` | SOCKET v2 波形重复发送间隔，最小值为 100 毫秒 |
| `HEARTBEAT_INTERVAL` | `60000` | SOCKET v2 心跳间隔，最小值为 1000 毫秒 |
| `WORKER_NAME` | `dg-lab-worker-hub` | Worker 服务名称 |

> `LOGIN_PASSWORD`、D1 ID 和 KV ID 不应提交到仓库。生产绑定只会写入 Actions 运行时生成且已被 Git 忽略的 `.wrangler-ci.toml` 与 `.wrangler-ci-secrets.json`。

### 4. 触发自动部署

可以使用以下任一方式：

1. 推送提交到 `main` 分支。
2. 打开 GitHub 仓库的 **Actions → Deploy Worker → Run workflow**，手动触发 `workflow_dispatch`。

工作流会先使用 lockfile 安装依赖，校验 Actions workflow 结构，并运行单元测试、TypeScript 检查，然后只调用一次 `scripts/deploy-worker.sh`。统一部署脚本严格按顺序执行：

1. 使用 Repository Secrets 生成临时 `.wrangler-ci.toml` 与 `.wrangler-ci-secrets.json`。
2. 在上传前检查 `DB`、`HUB_KV`、`ASSETS_BUCKET`、`ARCHIVE_BUCKET`、`DEVICE_DO`、`SOCKET_V2_DO`、运行参数和 `LOGIN_PASSWORD` 是否已经写入临时配置。
3. 执行 `wrangler d1 migrations apply DB --remote`。首次部署时会创建 schema，并通过 migration 写入默认 settings 和管理员；后续重复部署保持幂等。
4. 查询远端 D1，确认 bootstrap 标记、默认 settings 数量和管理员记录均已就绪。
5. 执行 `wrangler deploy --dry-run --strict --outdir dist/worker-upload`，将 Worker 构建为 `dist/worker-upload/worker.js`。
6. 使用 `wrangler deploy dist/worker-upload/worker.js --no-bundle --strict` 推送已经构建好的 Worker bundle，并绑定变量与 `LOGIN_PASSWORD` secret。
7. 无论部署成功或失败，都删除临时配置、密钥文件和 Actions 中的构建目录。

如果资源 ID、bucket 名称、Durable Object 声明或密码绑定缺失，脚本会在上传前失败并给出明确错误，而不是发布一个绑定不完整的 Worker。

### 5. 验证部署

部署完成后打开 Worker 域名：

```text
https://<你的 Worker 域名>/
```

也可以访问健康检查：

```text
https://<你的 Worker 域名>/api/health
```

正常响应示例：

```json
{ "ok": true, "service": "dg-lab-worker-hub", "storage": "d1+kv+r2+do" }
```

部署脚本会在首次发布时通过 migration 写入默认 settings 和管理员记录，并在上传 Worker 前查询远端 D1 验证初始化结果。运行时仍保留幂等 bootstrap 作为恢复保护。首次使用 `LOGIN_PASSWORD` 登录时，如果还没有设备，控制台会自动创建并选择 `默认设备`。

## 本地开发

### 1. 安装依赖

```sh
npm install
```

### 2. 配置本地密码

创建不会提交到仓库的 `.dev.vars`：

仓库已内置 `.github/workflows/deploy-worker.yml`，并将生产发布流程统一收敛到 `scripts/deploy-worker.sh`。推荐优先使用 GitHub Actions 部署，不需要手动维护生产环境 `wrangler.toml`：脚本会根据 Repository Secrets 生成临时 Wrangler 配置，检查 D1、单一 KV、R2、Durable Objects 和登录密码绑定，应用 D1 migrations 并验证初始化数据，构建可部署 bundle，最后将已经构建好的 bundle 推送到 Workers。Actions 同一时间只会执行一个生产部署，避免并发 migration 与发布互相干扰。

### 1. Fork 或复制仓库

将仓库放入自己的 GitHub 账号或组织，并确认默认分支为 `main`。

### 2. 创建 Cloudflare 资源

只需创建一个 D1 数据库、一个 KV namespace 和两个 R2 bucket：

```sh
npx wrangler login
npx wrangler d1 create dg-lab-worker-hub
npx wrangler kv namespace create HUB_KV
npx wrangler r2 bucket create dg-lab-assets
npx wrangler r2 bucket create dg-lab-archive
```

保存命令返回的 D1 数据库 UUID 和 KV namespace ID。R2 bucket 默认名称已经写入部署脚本；只有使用其他名称时才需要额外配置。

### 3. 配置 GitHub Repository Secrets

进入仓库的 **Settings → Secrets and variables → Actions → Repository secrets**，添加以下必填项：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token，需要具备 Workers、D1、KV 和 R2 的部署访问权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `LOGIN_PASSWORD` | 云端控制台登录密码；部署时作为 Worker secret 上传 |
| `D1_DATABASE_ID` | `npx wrangler d1 create` 返回的数据库 UUID |
| `HUB_KV_NAMESPACE_ID` | `npx wrangler kv namespace create` 返回的 namespace ID |

以下配置可选；未设置时部署脚本会使用默认值：

| Secret | 默认值 | 用途 |
| --- | --- | --- |
| `D1_DATABASE_NAME` | `dg-lab-worker-hub` | D1 数据库名称 |
| `HUB_KV_PREVIEW_NAMESPACE_ID` | 回退到生产 ID | KV preview namespace ID |
| `ASSETS_BUCKET_NAME` | `dg-lab-assets` | R2 波形与导出资源 bucket |
| `ARCHIVE_BUCKET_NAME` | `dg-lab-archive` | R2 冷日志归档 bucket |
| `SESSION_TTL_SECONDS` | `1800` | 登录会话 TTL，最小值为 300 秒 |
| `SOCKET_PULSE_INTERVAL_MS` | `1000` | SOCKET v2 波形重复发送间隔，最小值为 100 毫秒 |
| `HEARTBEAT_INTERVAL` | `60000` | SOCKET v2 心跳间隔，最小值为 1000 毫秒 |
| `WORKER_NAME` | `dg-lab-worker-hub` | Worker 服务名称 |

> `LOGIN_PASSWORD`、D1 ID 和 KV ID 不应提交到仓库。生产绑定只会写入 Actions 运行时生成且已被 Git 忽略的 `.wrangler-ci.toml` 与 `.wrangler-ci-secrets.json`。

### 4. 触发自动部署

可以使用以下任一方式：

1. 推送提交到 `main` 分支。
2. 打开 GitHub 仓库的 **Actions → Deploy Worker → Run workflow**，手动触发 `workflow_dispatch`。

工作流会先使用 lockfile 安装依赖并运行单元测试、TypeScript 检查，然后只调用一次 `scripts/deploy-worker.sh`。统一部署脚本严格按顺序执行：

1. 使用 Repository Secrets 生成临时 `.wrangler-ci.toml` 与 `.wrangler-ci-secrets.json`。
2. 在上传前检查 `DB`、`HUB_KV`、`ASSETS_BUCKET`、`ARCHIVE_BUCKET`、`DEVICE_DO`、`SOCKET_V2_DO`、运行参数和 `LOGIN_PASSWORD` 是否已经写入临时配置。
3. 执行 `wrangler d1 migrations apply DB --remote`。首次部署时会创建 schema，并通过 migration 写入默认 settings 和管理员；后续重复部署保持幂等。
4. 查询远端 D1，确认 bootstrap 标记、默认 settings 数量和管理员记录均已就绪。
5. 执行 `wrangler deploy --dry-run --strict --outdir dist/worker-upload`，将 Worker 构建为 `dist/worker-upload/worker.js`。
6. 使用 `wrangler deploy dist/worker-upload/worker.js --no-bundle --strict` 推送已经构建好的 Worker bundle，并绑定变量与 `LOGIN_PASSWORD` secret。
7. 无论部署成功或失败，都删除临时配置、密钥文件和 Actions 中的构建目录。

如果资源 ID、bucket 名称、Durable Object 声明或密码绑定缺失，脚本会在上传前失败并给出明确错误，而不是发布一个绑定不完整的 Worker。

### 5. 验证部署

部署完成后打开 Worker 域名：

```text
https://<你的 Worker 域名>/
```

也可以访问健康检查：

```text
https://<你的 Worker 域名>/api/health
```

正常响应示例：

```json
{ "ok": true, "service": "dg-lab-worker-hub", "storage": "d1+kv+r2+do" }
```

部署脚本会在首次发布时通过 migration 写入默认 settings 和管理员记录，并在上传 Worker 前查询远端 D1 验证初始化结果。运行时仍保留幂等 bootstrap 作为恢复保护。首次使用 `LOGIN_PASSWORD` 登录时，如果还没有设备，控制台会自动创建并选择 `默认设备`。

## 本地开发

### 1. 安装依赖

```sh
npm install
```

### 2. 配置本地密码

创建不会提交到仓库的 `.dev.vars`：

仓库已内置 `.github/workflows/deploy-worker.yml`。推荐优先使用 GitHub Actions 部署，不需要手动维护生产环境 `wrangler.toml`：工作流会根据 Repository Secrets 生成临时 Wrangler 配置，运行测试与部署前 dry-run，应用 D1 migrations，部署 Worker，并在结束时清理临时配置与密钥文件。同一时间只会执行一个生产部署，避免并发 migration 与发布互相干扰。

### 1. Fork 或复制仓库

将仓库放入自己的 GitHub 账号或组织，并确认默认分支为 `main`。

### 2. 创建 Cloudflare 资源

只需创建一个 D1 数据库、一个 KV namespace 和两个 R2 bucket：

```sh
npx wrangler login
npx wrangler d1 create dg-lab-worker-hub
npx wrangler kv namespace create HUB_KV
npx wrangler r2 bucket create dg-lab-assets
npx wrangler r2 bucket create dg-lab-archive
```

保存命令返回的 D1 数据库 UUID 和 KV namespace ID。R2 bucket 默认名称已经写入部署脚本；只有使用其他名称时才需要额外配置。

### 3. 配置 GitHub Repository Secrets

进入仓库的 **Settings → Secrets and variables → Actions → Repository secrets**，添加以下必填项：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token，需要具备 Workers、D1、KV 和 R2 的部署访问权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `LOGIN_PASSWORD` | 云端控制台登录密码；部署时作为 Worker secret 上传 |
| `D1_DATABASE_ID` | `npx wrangler d1 create` 返回的数据库 UUID |
| `HUB_KV_NAMESPACE_ID` | `npx wrangler kv namespace create` 返回的 namespace ID |

以下配置可选；未设置时部署脚本会使用默认值：

| Secret | 默认值 | 用途 |
| --- | --- | --- |
| `D1_DATABASE_NAME` | `dg-lab-worker-hub` | D1 数据库名称 |
| `HUB_KV_PREVIEW_NAMESPACE_ID` | 回退到生产 ID | KV preview namespace ID |
| `ASSETS_BUCKET_NAME` | `dg-lab-assets` | R2 波形与导出资源 bucket |
| `ARCHIVE_BUCKET_NAME` | `dg-lab-archive` | R2 冷日志归档 bucket |
| `SESSION_TTL_SECONDS` | `1800` | 登录会话 TTL，最小值为 300 秒 |
| `SOCKET_PULSE_INTERVAL_MS` | `1000` | SOCKET v2 波形重复发送间隔，最小值为 100 毫秒 |
| `HEARTBEAT_INTERVAL` | `60000` | SOCKET v2 心跳间隔，最小值为 1000 毫秒 |
| `WORKER_NAME` | `dg-lab-worker-hub` | Worker 服务名称 |

> `LOGIN_PASSWORD`、D1 ID 和 KV ID 不应提交到仓库。生产绑定只会写入 Actions 运行时生成且已被 Git 忽略的 `.wrangler-ci.toml` 与 `.wrangler-ci-secrets.json`。

### 4. 触发自动部署

可以使用以下任一方式：

1. 推送提交到 `main` 分支。
2. 打开 GitHub 仓库的 **Actions → Deploy Worker → Run workflow**，手动触发 `workflow_dispatch`。

工作流会按顺序执行：

1. 检出仓库。
2. 使用 Repository Secrets 生成临时 Wrangler 配置。
3. 使用 lockfile 安装依赖，并运行单元测试与 TypeScript 检查。
4. 使用生成的临时配置执行 `wrangler deploy --dry-run`。
5. 执行 `wrangler d1 migrations apply DB --remote`。
6. 使用 `cloudflare/wrangler-action` 部署 Worker，并上传 `LOGIN_PASSWORD` secret。
7. 无论部署成功或失败，都删除临时配置和密钥文件。

### 5. 验证部署

部署完成后打开 Worker 域名：

```text
https://<你的 Worker 域名>/
```

也可以访问健康检查：

```text
https://<你的 Worker 域名>/api/health
```

正常响应示例：

```json
{ "ok": true, "service": "dg-lab-worker-hub", "storage": "d1+kv+r2+do" }
```

首次访问健康检查或首次登录时，Worker 会幂等写入默认 settings 和管理员记录。首次使用 `LOGIN_PASSWORD` 登录时，如果还没有设备，控制台会自动创建并选择 `默认设备`。

## 本地开发

### 1. 安装依赖

```sh
npm install
```

### 2. 配置本地密码

创建不会提交到仓库的 `.dev.vars`：

仓库已内置 `.github/workflows/deploy-worker.yml`。推荐优先使用 GitHub Actions 部署，不需要手动维护生产环境 `wrangler.toml`：工作流会根据 Repository Secrets 生成临时 Wrangler 配置，应用 D1 migrations，部署 Worker，并在结束时清理临时配置与密钥文件。

### 1. Fork 或复制仓库

将仓库放入自己的 GitHub 账号或组织，并确认默认分支为 `main`。

### 2. 创建 Cloudflare 资源

只需创建一个 D1 数据库、一个 KV namespace 和两个 R2 bucket：

```sh
npx wrangler login
npx wrangler d1 create dg-lab-worker-hub
npx wrangler kv namespace create HUB_KV
npx wrangler r2 bucket create dg-lab-assets
npx wrangler r2 bucket create dg-lab-archive
```

保存命令返回的 D1 数据库 UUID 和 KV namespace ID。R2 bucket 默认名称已经写入部署脚本；只有使用其他名称时才需要额外配置。

### 3. 配置 GitHub Repository Secrets

进入仓库的 **Settings → Secrets and variables → Actions → Repository secrets**，添加以下必填项：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token，需要具备 Workers、D1、KV 和 R2 的部署访问权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `LOGIN_PASSWORD` | 云端控制台登录密码；部署时作为 Worker secret 上传 |
| `D1_DATABASE_ID` | `npx wrangler d1 create` 返回的数据库 UUID |
| `HUB_KV_NAMESPACE_ID` | `npx wrangler kv namespace create` 返回的 namespace ID |

以下配置可选；未设置时部署脚本会使用默认值：

| Secret | 默认值 | 用途 |
| --- | --- | --- |
| `D1_DATABASE_NAME` | `dg-lab-worker-hub` | D1 数据库名称 |
| `HUB_KV_PREVIEW_NAMESPACE_ID` | 回退到生产 ID | KV preview namespace ID |
| `ASSETS_BUCKET_NAME` | `dg-lab-assets` | R2 波形与导出资源 bucket |
| `ARCHIVE_BUCKET_NAME` | `dg-lab-archive` | R2 冷日志归档 bucket |
| `SESSION_TTL_SECONDS` | `1800` | 登录会话 TTL，最小值为 300 秒 |
| `WORKER_NAME` | `dg-lab-worker-hub` | Worker 服务名称 |
- 密码登录、短期会话、设备归属校验，以及首次登录自动创建并选择默认设备。
- DG-LAB 强度、波形、通道清空、状态反馈和心跳协议处理。
- DG-LAB SOCKET v2 兼容的公开 WebSocket Hub，可供第三方控制端与 APP 配对。
- REST API、MCP 风格工具接口和响应式网页控制台。
- D1 migration、运行时幂等 bootstrap、CI 自动迁移与部署。
- 支持密码登录、会话过期控制和设备归属校验；首次登录会自动创建并选择默认设备。
- 支持 DG-LAB 强度、波形、通道清空、状态反馈和心跳协议处理。
- 支持绑定校验、强度上下限保护、消息长度限制、严格波形校验和按设备限流。
- 提供 REST API 和 MCP 风格工具接口，用于控制设备。
- 内置网页控制台，可用于登录、设备管理、控制、日志查看和 MCP 工具测试。

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

| `SESSION_KV` | Workers KV | 短期登录 token 和临时票据 | 否，可过期并重建 |
| `RATE_LIMIT_KV` | Workers KV | 登录与后续分钟级限流计数 | 否，可过期并重建 |
| `CACHE_KV` | Workers KV | 设备状态与绑定关系摘要 | 否，仅作为副本 |
| `ASSETS_BUCKET` | R2 | 波形模板、大对象、导出文件 | 否 |
| `ARCHIVE_BUCKET` | R2 | 冷审计日志与设备状态归档 | 否 |

实时状态不会写入 KV 或 D1 作为主路径。Worker 在读取状态或执行控制命令后，只会向 `CACHE_KV` 写入带 TTL 的可丢失摘要。设备秒级命令限流继续由 Durable Object 执行；KV 仅用于 TTL 不低于 60 秒的低频限流窗口。
- Password login with expiring sessions and per-device ownership checks. The first login automatically creates and selects a default device.
- DG-LAB strength, waveform, channel-clear, feedback, and heartbeat protocol handling.
- Binding enforcement, strength bounds, message-length checks, strict waveform validation, and per-device command rate limits.
- REST APIs and MCP-style tool endpoints for device control.
- Built-in browser console for login, device management, control, logs, and MCP tool testing.

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

```sh

```sh
npm run db:migrate:local
```

### 4. 启动 Worker

```sh
将命令返回的 ID 填入 `wrangler.toml`，然后添加 Wrangler 密钥 `LOGIN_PASSWORD`：
Copy the returned IDs into `wrangler.toml`, then add `LOGIN_PASSWORD` as a Wrangler secret:

```sh
npx wrangler secret put LOGIN_PASSWORD
npm run dev
```

Wrangler 本地模式会为 D1、KV 和 R2 建立持久化的本地资源。

## Cloudflare 资源创建

首次部署前创建一个 D1 数据库、一个 KV namespace 和两个 R2 bucket：

```sh
npx wrangler d1 create dg-lab-worker-hub
npx wrangler kv namespace create HUB_KV

首次部署前创建一个 D1 数据库、一个 KV namespace 和两个 R2 bucket：

```sh
npx wrangler d1 create dg-lab-worker-hub
npx wrangler kv namespace create HUB_KV
首次部署前创建一个 D1 数据库、三个 KV namespace 和两个 R2 bucket：

```sh
npx wrangler d1 create dg-lab-worker-hub
npx wrangler kv namespace create SESSION_KV
npx wrangler kv namespace create RATE_LIMIT_KV
npx wrangler kv namespace create CACHE_KV
npx wrangler r2 bucket create dg-lab-assets
npx wrangler r2 bucket create dg-lab-archive
```

将返回的资源 ID 配置为 Repository Secrets，再触发 GitHub Actions 部署。

```sh
npx wrangler d1 create dg-lab-worker-hub
npx wrangler kv namespace create SESSION_KV
npx wrangler kv namespace create RATE_LIMIT_KV
npx wrangler kv namespace create CACHE_KV
npx wrangler r2 bucket create dg-lab-assets
npx wrangler r2 bucket create dg-lab-archive
```

将返回的资源 ID 配置为 Repository Secrets，再触发 GitHub Actions 部署。
- `POST /api/auth/login`，请求体为 `{ "password": "..." }`。登录成功后会返回会话和可直接使用的默认设备；首次登录时自动创建设备。
- `GET|POST /api/devices`
- `GET /api/devices/:id/status`
- `GET /api/devices/:id/logs`
- `POST /api/devices/:id/{bind,unbind,strength,waveform,clear}`
- `GET /api/devices/:id/connect?token=...`（设备 APP 使用的 WebSocket 接口）
- `GET /api/mcp/tools`
- `POST /api/mcp/tool/{list_devices,get_device_status,set_strength,send_waveform,clear_channel,bind_device,unbind_device}`

> `LOGIN_PASSWORD`、D1 ID 和 KV ID 不应提交到仓库。生产绑定只会写入 Actions 运行时生成且已被 Git 忽略的 `.wrangler-ci.toml` 与 `.wrangler-ci-secrets.json`。

### 4. 触发自动部署

可以使用以下任一方式：

1. 推送提交到 `main` 分支。
2. 打开 GitHub 仓库的 **Actions → Deploy Worker → Run workflow**，手动触发 `workflow_dispatch`。

工作流会按顺序执行：

1. 检出仓库。
2. 使用 Repository Secrets 生成临时 Wrangler 配置。
3. 执行 `wrangler d1 migrations apply DB --remote`。
4. 使用 `cloudflare/wrangler-action` 部署 Worker，并上传 `LOGIN_PASSWORD` secret。
5. 无论部署成功或失败，都删除临时配置和密钥文件。

### 5. 验证部署

部署完成后打开 Worker 域名：

```text
https://<你的 Worker 域名>/
```

也可以访问健康检查：

```text
https://<你的 Worker 域名>/api/health
```

正常响应示例：

```json
{ "ok": true, "service": "dg-lab-worker-hub", "storage": "d1+kv+r2+do" }
```

首次访问健康检查或首次登录时，Worker 会幂等写入默认 settings 和管理员记录。首次使用 `LOGIN_PASSWORD` 登录时，如果还没有设备，控制台会自动创建并选择 `默认设备`。

## 本地开发

### 1. 安装依赖

```sh
npm install
```

### 2. 配置本地密码

创建不会提交到仓库的 `.dev.vars`：
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

### 必填 Repository Secrets


### 必填 Repository Secrets

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare 部署与资源访问凭据 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `LOGIN_PASSWORD` | 控制台登录密码，作为 Worker secret 上传 |
| `D1_DATABASE_ID` | D1 数据库 UUID |
| `SESSION_KV_NAMESPACE_ID` | 会话 KV namespace ID |
| `RATE_LIMIT_KV_NAMESPACE_ID` | 限流 KV namespace ID |
| `CACHE_KV_NAMESPACE_ID` | 缓存 KV namespace ID |

### 可选 Repository Secrets

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
| `SESSION_KV_NAMESPACE_ID` | 会话 KV namespace ID |
| `RATE_LIMIT_KV_NAMESPACE_ID` | 限流 KV namespace ID |
| `CACHE_KV_NAMESPACE_ID` | 缓存 KV namespace ID |

### 可选 Repository Secrets
| 密钥 | 是否必填 | 用途 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | 是 | Cloudflare API token，需要具备部署 Workers 和使用已配置 KV 命名空间的权限。 |
| `CLOUDFLARE_ACCOUNT_ID` | 是 | Worker 和 KV 命名空间所属的 Cloudflare 账号 ID。 |
| `LOGIN_PASSWORD` | 是 | `POST /api/auth/login` 使用的登录密码。部署时会将其上传为加密的 Worker secret。 |
| `HUB_KV_NAMESPACE_ID` | 是 | 绑定到 `HUB_KV` 的生产环境 KV 命名空间 ID。 |
| `HUB_KV_PREVIEW_NAMESPACE_ID` | 否 | 预览环境 KV 命名空间 ID。未配置时会回退到 `HUB_KV_NAMESPACE_ID`。 |
| `SESSION_TTL_SECONDS` | 否 | 会话有效期，默认值为 `86400` 秒，且不能小于 `300` 秒。 |
| `WORKER_NAME` | 否 | Worker 服务名称，默认值为 `dg-lab-worker-hub`。 |

`CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 用于 Wrangler 身份验证，并会直接传递给 GitHub Action。应用配置仅由 `scripts/prepare-ci-config.sh` 写入临时且已忽略的文件，因此无需将生产环境 ID 或 token 提交到 `wrangler.toml`。

本地开发时，请继续使用不会提交到仓库的 `.dev.vars` 文件：
- `GET /api/devices/:id/connect?token=...` (WebSocket endpoint for the device APP)
- `GET /api/mcp/tools`
- `POST /api/mcp/tool/{list_devices,get_device_status,set_strength,send_waveform,clear_channel,bind_device,unbind_device}`

| Secret | 默认值 | 用途 |
| --- | --- | --- |
| `D1_DATABASE_NAME` | `dg-lab-worker-hub` | D1 数据库名称 |
| `SESSION_KV_PREVIEW_NAMESPACE_ID` | 回退到生产 ID | 会话 KV preview ID |
| `RATE_LIMIT_KV_PREVIEW_NAMESPACE_ID` | 回退到生产 ID | 限流 KV preview ID |
| `CACHE_KV_PREVIEW_NAMESPACE_ID` | 回退到生产 ID | 缓存 KV preview ID |
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
| Secret | Required | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token authorized to deploy Workers and use the configured KV namespace. |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account containing the Worker and KV namespace. |
| `LOGIN_PASSWORD` | Yes | Login password used by `POST /api/auth/login`. It is uploaded as an encrypted Worker secret. |
| `HUB_KV_NAMESPACE_ID` | Yes | Production KV namespace ID bound as `HUB_KV`. |
| `HUB_KV_PREVIEW_NAMESPACE_ID` | No | Preview KV namespace ID. It falls back to `HUB_KV_NAMESPACE_ID` when omitted. |
| `SESSION_TTL_SECONDS` | No | Session lifetime. It defaults to `86400` seconds and must be at least `300`. |
| `WORKER_NAME` | No | Worker service name. It defaults to `dg-lab-worker-hub`. |

该公开 WebSocket Hub 面向郊狼脉冲主机 3.0 APP SOCKET 功能，与需要登录的管理 API 相互独立：

1. 第三方控制端连接 `wss://<你的域名>/socket`，服务端返回 `type: "bind"` 消息并分配 UUID v4 `clientId`。
2. 控制端生成二维码：`https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#wss://<你的域名>/<clientId>`。
3. APP 扫码连接二维码地址，服务端分配 `targetId`；APP 再发送 `type: "bind"` 完成配对。
4. 配对后，控制端可发送 v2 的 `type: 1`、`2`、`3`、`4` 和 `clientMsg` 消息。

Hub 会拒绝超过 1950 字符的 JSON 消息；单次波形数组最多包含 100 条 8 字节 HEX 数据。`clientMsg.time` 默认为 5 秒，允许范围为 1 到 60 秒。可选 Worker 变量 `SOCKET_PULSE_INTERVAL_MS` 用于调整波形重复发送间隔，`HEARTBEAT_INTERVAL` 用于调整心跳间隔。
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

Wrangler 本地模式会为 D1、KV 和 R2 建立持久化的本地资源。需要从本机手动执行与 Actions 完全一致的生产发布时，请先导出 README 上方 Secrets 表中的环境变量，再运行：

```sh
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="..."
export LOGIN_PASSWORD="..."
export D1_DATABASE_ID="..."
export HUB_KV_NAMESPACE_ID="..."
npm run deploy
```

只验证配置和构建产物、不连接 Cloudflare 远端资源或上传 Worker 时，可以运行：

```sh
LOGIN_PASSWORD="local-check" \
D1_DATABASE_ID="00000000-0000-0000-0000-000000000000" \
HUB_KV_NAMESPACE_ID="00000000000000000000000000000000" \
npm run deploy:dry-run
```

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

实时状态不会写入 KV 或 D1 作为主路径。Worker 在读取状态或执行控制命令后，只会向 `HUB_KV` 写入带 TTL 的可丢失摘要。设备秒级命令限流继续由 Durable Object 执行；KV 仅用于 TTL 不低于 60 秒的低频限流窗口。`HUB_KV` 使用 `session:`、`rl:`、`device:state:` 和 `device:binding:` 前缀隔离不同用途，无需为每类临时数据单独创建 namespace。

## D1 schema 与 bootstrap

D1 schema 位于 `migrations/0001_init.sql`，部署期默认数据位于 `migrations/0002_seed_bootstrap.sql`。schema 包含：

- `users`
- `devices`
- `device_bindings`
- `sessions`
- `audit_logs`
- `waveform_templates`
- `settings`

生产 Actions 工作流会在部署 Worker 前自动应用 migration，并立即查询远端 D1 验证默认 settings 与管理员已经初始化。Worker 第一次访问健康检查或需要 D1 的业务接口时仍会执行幂等 bootstrap，作为数据被意外删除后的恢复保护。schema 变更仍由 migration 管理，不会在普通请求中隐式执行 DDL。

默认 settings 包含：

- `bootstrap.completed = true`
- `app.name = DG-LAB Cloud Console`
- `security.max_strength_step = 10`
- `security.max_message_length = 1950`
- `security.session_ttl_minutes = 30`
- `security.qr_ttl_seconds = 180`
- `audit.hot_retention_days = 7`
- `audit.archive_enabled = true`

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
```

### 3. 应用本地 D1 migration

```sh
npm run db:migrate:local
```

```

### 3. 应用本地 D1 migration

```sh
npm run db:migrate:local
```

### 4. 启动 Worker

```sh
npm run dev
```

Wrangler 本地模式会为 D1、KV 和 R2 建立持久化的本地资源。需要手动部署到已经配置好的 Cloudflare 环境时，可以运行：

```sh
npm run db:migrate:remote
npm run deploy
```

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

实时状态不会写入 KV 或 D1 作为主路径。Worker 在读取状态或执行控制命令后，只会向 `HUB_KV` 写入带 TTL 的可丢失摘要。设备秒级命令限流继续由 Durable Object 执行；KV 仅用于 TTL 不低于 60 秒的低频限流窗口。`HUB_KV` 使用 `session:`、`rl:`、`device:state:` 和 `device:binding:` 前缀隔离不同用途，无需为每类临时数据单独创建 namespace。

## D1 schema 与 bootstrap

D1 schema 位于 `migrations/0001_init.sql`，包含：

- `users`
- `devices`
- `device_bindings`
- `sessions`
- `audit_logs`
- `waveform_templates`
- `settings`

生产 Actions 工作流会在部署 Worker 前自动应用 migration。Worker 第一次访问健康检查或需要 D1 的业务接口时，会幂等写入默认 settings 和默认管理员。schema 变更仍由 migration 管理，不会在普通请求中隐式执行 DDL。

默认 settings 包含：

- `bootstrap.completed = true`
- `app.name = DG-LAB Cloud Console`
- `security.max_strength_step = 10`
- `security.max_message_length = 1950`
- `security.session_ttl_minutes = 30`
- `security.qr_ttl_seconds = 180`
- `audit.hot_retention_days = 7`
- `audit.archive_enabled = true`

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
```

## DG-LAB SOCKET v2 兼容接口

Worker 现在提供与 DG-LAB APP SOCKET 控制兼容的公开 WebSocket Hub。该接口面向郊狼脉冲主机 3.0 的 APP SOCKET 功能，与需要登录的管理 API 相互独立：

1. 第三方控制端连接 `wss://<你的域名>/socket`，服务端返回 `type: "bind"` 消息并分配 UUID v4 `clientId`。
2. 控制端生成二维码：`https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#wss://<你的域名>/<clientId>`。
3. APP 扫码后连接二维码中的地址，服务端分配 `targetId`；APP 再发送 `type: "bind"` 消息完成配对。
4. 配对后，控制端可以发送 v2 的 `type: 1`、`2`、`3`、`4` 和 `clientMsg` 消息。服务端会转换并转发强度、清空队列和波形指令，也会将 APP 状态回报转发给控制端。

为避免 APP 丢弃消息，Hub 会拒绝超过 1950 字符的 JSON 消息；单次波形数组最多包含 100 条 8 字节 HEX 数据。`clientMsg.time` 默认为 5 秒，允许范围为 1 到 60 秒。可选 Worker 变量 `SOCKET_PULSE_INTERVAL_MS` 用于调整波形重复发送间隔，默认值为 1000 毫秒，且不会低于 100 毫秒。Hub 也会发送 `type: "heartbeat"`、`message: "200"` 的心跳包；可选 Worker 变量 `HEARTBEAT_INTERVAL` 用于调整间隔，默认值为 60000 毫秒，且不会低于 1000 毫秒。
