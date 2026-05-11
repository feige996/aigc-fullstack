# AIGC Fullstack

AIGC 全栈 monorepo，用于管理用户端生成工作流、运营后台、主业务 API 和 AI Worker 服务。

## 技术栈

```txt
Monorepo：pnpm workspace + Turborepo
用户端 Web：Vue 3 + TypeScript + Vite + chadcn/vue
运营后台 Admin：Vue 3 + TypeScript + Vite + Element Plus
主业务 API：NestJS + Prisma + MySQL
AI 服务：FastAPI + uv
队列：RabbitMQ
缓存：Redis
对象存储：兼容 COS/OSS/S3 的对象存储
本地对象存储模拟器：MinIO
```

## 仓库结构

```txt
apps/
  web/          用户端 Vue 应用
  admin/        运营后台 Vue 应用
  api/          NestJS 主业务 API
  ai-service/   FastAPI AI 服务和 Worker

packages/
  shared-contracts/  共享枚举、事件名、队列名和 API 契约
  shared-config/     共享 TypeScript 和工具配置
  shared-utils/      共享纯工具函数

infra/
  compose/      本地 Docker Compose 基础设施

docs/           架构和工程设计文档
scripts/        开发、迁移和种子数据脚本
```

## 环境要求

推荐版本：

```txt
Node.js 22 LTS
pnpm 10.x
Python 3.12
uv
Docker
Docker Compose
```

## 安装依赖

安装 Node workspace 依赖：

```bash
pnpm install
```

安装 Python AI 服务依赖：

```bash
cd apps/ai-service
uv sync
```

## 本地基础设施

启动 MySQL、Redis、RabbitMQ 和 MinIO：

```bash
docker compose -f infra/compose/docker-compose.yml up -d
```

服务地址：

```txt
MySQL：localhost:3306
Redis：localhost:6379
RabbitMQ：localhost:5672
RabbitMQ Management：http://localhost:15672
MinIO API：http://localhost:9000
MinIO Console：http://localhost:9001
```

本地默认账号密码只用于开发环境，定义在 `infra/compose/docker-compose.yml`。

## 本地开发

启动所有 Node workspace 开发任务：

```bash
pnpm dev
```

启动单个应用：

```bash
pnpm --filter @aigc/web dev
pnpm --filter @aigc/admin dev
pnpm --filter @aigc/api dev
```

启动 AI 服务：

```bash
cd apps/ai-service
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

## 构建和检查

```bash
pnpm build
pnpm lint
pnpm test
pnpm typecheck
```

## 架构

主要运行链路：

```txt
apps/web 或 apps/admin
  |
  | HTTP / SSE
  v
apps/api NestJS
  |
  | Prisma / MySQL
  v
MySQL

apps/api NestJS
  |
  | RabbitMQ
  v
apps/ai-service FastAPI Worker
  |
  | SDK / HTTP / Workflow
  v
模型供应商 / ComfyUI / 自研模型
```

关键设计文档：

- [文档写作约定](./docs/documentation-style-guide.md)
- [Platform Core 架构边界](./docs/platform-core-architecture.md)
- [通用智能项目平台演进路线](./docs/generalized-platform-roadmap.md)
- [Feature Manifest 设计](./docs/feature-manifest.md)
- [Feature Registry 设计](./docs/feature-registry.md)
- [AIGC Generation Feature 边界](./docs/aigc-generation-feature.md)
- [Task 契约设计](./docs/task-contracts.md)
- [本地浏览器验证](./docs/local-browser-verification.md)
- [认证账户模型](./docs/auth-account-model.md)
- [Monorepo 总体架构](./docs/aigc-monorepo-architecture.md)
- [AI 服务与 Monorepo 边界决策](./docs/aigc-ai-service-monorepo-decision.md)
- [NestJS 与 FastAPI 后端分工](./docs/aigc-backend-fastapi-nestjs-architecture.md)
- [队列选型：RabbitMQ 与 BullMQ](./docs/aigc-queue-rabbitmq-vs-bullmq.md)
- [实时推送：SSE 与 WebSocket](./docs/aigc-realtime-sse-vs-websocket.md)
- [幂等与 Attempt 模型](./docs/aigc-idempotency-and-attempt.md)
- [计费一致性](./docs/aigc-billing-consistency.md)
- [资产生命周期与存储](./docs/aigc-asset-lifecycle-and-storage.md)
- [审核与风控](./docs/aigc-moderation-and-risk-control.md)
- [可观测性与运维](./docs/aigc-observability-and-ops.md)

## 当前范围

当前仓库包含 monorepo 基础结构和架构文档。第一个实现里程碑是 mock 端到端生成链路：

```txt
Web -> API -> MySQL -> RabbitMQ -> AI Service -> RabbitMQ -> API -> SSE -> Web
```
