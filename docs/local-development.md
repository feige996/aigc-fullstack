# 本地开发手册

本文档记录本地开发环境的启动方式、常用命令和生成链路排查方法。根目录
`README.md` 只保留快速入口，详细说明放在这里。

## 首次初始化

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

本地默认账号密码只用于开发环境，定义在 `infra/compose/docker-compose.yml` 和
`.env.example`。

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

常用环境变量：

```txt
API_BASE_URL=http://localhost:3000/api
SMOKE_PHONE_NUMBER=13900139000
SMOKE_PASSWORD=password123
SMOKE_PROMPT=smoke test product photo
SMOKE_TIMEOUT_MS=30000
SMOKE_INTERVAL_MS=1000
```

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
