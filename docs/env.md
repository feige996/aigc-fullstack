# 环境变量说明

本文档说明 `.env.example` 中的本地开发环境变量。`.env` 不应提交到仓库。

## 数据库、缓存和队列

| 变量 | 默认值 | 使用方 | 本地说明 | 生产说明 |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | `mysql://aigc:aigc_password@localhost:3306/aigc` | API / Prisma | 指向 Docker Compose MySQL | 必须替换为生产数据库地址 |
| `REDIS_URL` | `redis://localhost:6379` | API / 未来缓存能力 | 指向 Docker Compose Redis | 必须替换为生产 Redis 地址 |
| `RABBITMQ_URL` | `amqp://aigc:aigc_password@localhost:5672` | API / AI worker | API 发布任务，worker 消费任务 | 必须替换为生产 RabbitMQ 地址 |

## 模型供应商

| 变量 | 默认值 | 使用方 | 本地说明 | 生产说明 |
| --- | --- | --- | --- | --- |
| `MODEL_PROVIDER` | `mock` | AI worker | 使用 mock provider，不产生外部费用 | 按部署目标改为真实 provider |
| `PROVIDER_TIMEOUT_SECONDS` | `60` | AI worker | provider 请求超时时间 | 按真实 provider SLA 调整 |
| `PROVIDER_MAX_RETRIES` | `0` | AI worker | 本地默认不重试 | 生产可按失败策略调整 |
| `PROVIDER_MOCK_LATENCY_SECONDS` | `1` | AI worker | mock provider 模拟延迟 | 仅 mock provider 使用 |
| `OPENAI_API_KEY` | 空 | AI worker | mock provider 不需要 | 使用 OpenAI provider 时必须配置 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | AI worker | OpenAI API 默认地址 | 如使用代理或兼容 API，可替换 |

## 对象存储

| 变量 | 默认值 | 使用方 | 本地说明 | 生产说明 |
| --- | --- | --- | --- | --- |
| `OBJECT_STORAGE_PROVIDER` | `minio` | API / AI worker | 使用本地 MinIO | 按云厂商或对象存储实现调整 |
| `OBJECT_STORAGE_ENDPOINT` | `http://localhost:9000` | API / AI worker | MinIO API 地址 | 必须替换为生产对象存储 endpoint |
| `OBJECT_STORAGE_BUCKET` | `aigc-assets` | API / AI worker | 本地资产 bucket | 生产 bucket 需预先创建或由部署流程创建 |
| `OBJECT_STORAGE_REGION` | `local` | API / AI worker | 本地占位 region | 按云厂商 region 设置 |
| `OBJECT_STORAGE_ACCESS_KEY` | `minioadmin` | API / AI worker | MinIO 默认账号 | 必须替换为生产访问凭证 |
| `OBJECT_STORAGE_SECRET_KEY` | `minioadmin` | API / AI worker | MinIO 默认密码 | 必须替换为生产访问凭证 |

## 认证和实时推送

| 变量 | 默认值 | 使用方 | 本地说明 | 生产说明 |
| --- | --- | --- | --- | --- |
| `JWT_SECRET` | `replace-me` | API | 本地 JWT 签名密钥 | 必须替换为高强度随机密钥 |
| `SSE_TICKET_SECRET` | `replace-me` | API | 本地 SSE ticket 签名密钥 | 必须替换为高强度随机密钥 |

## Seed 和 smoke 可选变量

这些变量不在 `.env.example` 中强制列出，可按需在命令行覆盖。

| 变量 | 默认值 | 使用方 | 说明 |
| --- | --- | --- | --- |
| `SEED_ADMIN_PHONE_NUMBER` | `13900139000` | API seed | 默认管理员手机号 |
| `SEED_ADMIN_PASSWORD` | `password123` | API seed | 默认管理员密码 |
| `SEED_ADMIN_DISPLAY_NAME` | `Admin User` | API seed | 默认管理员显示名 |
| `API_BASE_URL` | `http://localhost:3000/api` | smoke | smoke 目标 API |
| `SMOKE_PHONE_NUMBER` | `13900139000` | smoke | smoke 登录手机号 |
| `SMOKE_PASSWORD` | `password123` | smoke | smoke 登录密码 |
| `SMOKE_PROMPT` | `smoke test product photo` | smoke | smoke 任务 prompt |
| `SMOKE_TIMEOUT_MS` | `30000` | smoke | 等待任务终态的最大时间 |
| `SMOKE_INTERVAL_MS` | `1000` | smoke | 任务轮询间隔 |
