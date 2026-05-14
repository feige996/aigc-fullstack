# 本地开发手册

本文档记录本地开发环境的启动方式、常用命令和生成链路排查方法。根目录
`README.md` 只保留快速入口，详细说明放在这里。

## 首次初始化

可以先运行本地初始化 helper：

```bash
pnpm setup
```

`pnpm setup` 会检查本地依赖状态，并在 `.env` 不存在时从 `.env.example` 创建。
它不会覆盖已有 `.env`，不会自动安装依赖，也不会自动启动 Docker 容器。

安装 Node workspace 依赖：

```bash
pnpm install
```

安装 Python AI 服务依赖：

```bash
cd apps/ai-service
uv sync
cd ../..
```

复制本地环境变量：

```bash
cp .env.example .env
```

启动 MySQL、Redis、RabbitMQ 和 MinIO：

```bash
docker compose -f infra/compose/docker-compose.yml up -d
```

如果需要查看部署模板，可以参考：

- [部署说明](./deployment.md)

本地默认账号密码只用于开发环境，定义在 `infra/compose/docker-compose.yml` 和
`.env.example`。环境变量详情见 [环境变量说明](./env.md)。

初始化数据库 schema：

```bash
pnpm --filter @aigc/api prisma:migrate
```

写入默认 seed 数据：

```bash
pnpm --filter @aigc/api seed
```

默认 seed 会创建或更新一个超级管理员账号：

```txt
phoneNumber：13900139000
password：password123
role：super_admin
```

可以通过这些环境变量覆盖默认 seed 账号：

```txt
SEED_ADMIN_PHONE_NUMBER
SEED_ADMIN_PASSWORD
SEED_ADMIN_DISPLAY_NAME
```

当数据库为空、迁移后需要补默认账号，或 smoke 登录失败时，重新运行 seed。
seed 使用 upsert，不会重复创建同一手机号用户，但会更新该用户密码、显示名、角色和状态。

## 开发命令

默认启动完整本地开发环境：

```bash
pnpm dev
```

`pnpm dev` 会启动：

```txt
@aigc/web#dev             用户端 Web
@aigc/admin#dev           运营后台 Admin
@aigc/api#dev             NestJS API
@aigc/ai-service#dev      FastAPI AI HTTP 服务
@aigc/ai-service#worker  RabbitMQ 队列 worker
```

如果只想启动应用开发服务，不启动 AI worker：

```bash
pnpm dev:apps
```

`pnpm dev:apps` 会启动 Web、Admin、API 和 AI Service HTTP 服务，不启动
`@aigc/ai-service#worker`。

如果只需要调试用户端生成链路：

```bash
pnpm dev:generation
```

`pnpm dev:generation` 只启动 Web、API 和 AI worker，不启动 Admin，也不启动
AI Service HTTP 服务。

启动单个应用或 worker：

```bash
pnpm --filter @aigc/web dev
pnpm --filter @aigc/admin dev
pnpm --filter @aigc/api dev
pnpm --filter @aigc/ai-service dev
pnpm --filter @aigc/ai-service worker
```

其中 `pnpm --filter @aigc/ai-service dev` 启动的是 AI Service 的 FastAPI HTTP 服务。
`pnpm --filter @aigc/ai-service worker` 是队列常驻进程，启动后保持运行，不要关闭终端。worker 会一直监听 RabbitMQ 的 `image.generate.queue`，消费 API 发布的生成任务，并把成功或失败结果发回 API。

## 本地服务地址

```txt
Web：http://localhost:5173
Admin：http://localhost:5174
API：http://localhost:3000/api
AI Service HTTP：http://localhost:8000
RabbitMQ Management：http://localhost:15672
MinIO Console：http://localhost:9001
```

如果端口已被占用，Vite 可能会自动选择下一个端口；API 和 AI Service HTTP
服务默认不会自动换端口。

## 生成链路烟测

完整生成链路启动后，可以运行烟测：

```bash
pnpm smoke:generation
```

烟测会使用默认账号登录，创建一个 mock 文生图任务，等待任务成功，检查输出资产并下载文件。
如果 API 不可用、登录失败、任务超时或资产下载失败，烟测会输出下一步排查建议。
遇到任务长时间停在 `queued` 时，优先运行 `pnpm doctor` 检查 worker consumer。

常用环境变量：

```txt
API_BASE_URL=http://localhost:3000/api
SMOKE_PHONE_NUMBER=13900139000
SMOKE_PASSWORD=password123
SMOKE_PROMPT=smoke test product photo
SMOKE_TIMEOUT_MS=30000
SMOKE_INTERVAL_MS=1000
```

## 本地环境诊断

如果本地服务状态不确定，可以运行：

```bash
pnpm doctor
```

诊断会检查基础命令、`.env`、Docker 基础设施容器、API 健康检查、MinIO 健康检查和
RabbitMQ 队列 consumer 状态。存在失败项时命令会返回非零退出码。

## queued 状态排查

如果任务一直停在 `queued` / `queue_publish`，检查队列是否有 worker consumer：

```bash
docker exec aigc-rabbitmq rabbitmqctl list_queues name messages consumers
```

如果 `image.generate.queue` 有消息但 `consumers` 是 `0`，说明 AI worker 没有运行或没有连上
RabbitMQ。通常先确认：

```bash
pnpm dev
```

或单独启动 worker：

```bash
pnpm --filter @aigc/ai-service worker
```
