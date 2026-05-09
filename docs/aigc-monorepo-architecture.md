# AIGC Monorepo 总体架构设计

## 目标

本文档用于说明 AIGC 全栈项目的 monorepo 目录结构、前端技术栈、后端服务边界、数据库选型，以及各应用之间的协作方式。

推荐结论：

- 项目采用 monorepo 管理前端、后台、NestJS API、FastAPI AI 服务、共享契约、部署配置和文档。
- 用户端 Web 使用 Vue 3、TypeScript、Vite 和 chadcn/vue。
- 运营后台 Admin 使用 Vue 3、TypeScript、Vite 和 Element Plus。
- 主业务后端使用 NestJS，负责用户、权限、任务、计费、资产、审核状态和运营后台能力。
- AI 能力服务使用 FastAPI，负责模型适配、Prompt 处理、媒体处理、供应商回调和 Worker 执行。
- 主数据库使用 MySQL，配合 Redis、RabbitMQ 和 COS/OSS/S3 组成基础设施。

## 总体目录结构

推荐目录：

```txt
aigc-fullstack/
  apps/
    web/
    admin/
    api/
    ai-service/

  packages/
    shared-contracts/
    shared-config/
    shared-ui/
    shared-utils/

  infra/
    docker/
    compose/
    k8s/
    rabbitmq/
    mysql/
    redis/

  docs/
    aigc-monorepo-architecture.md
    aigc-backend-fastapi-nestjs-architecture.md
    aigc-queue-rabbitmq-vs-bullmq.md
    aigc-realtime-sse-vs-websocket.md
    aigc-asset-lifecycle-and-storage.md
    aigc-idempotency-and-attempt.md
    aigc-billing-consistency.md
    aigc-moderation-and-risk-control.md
    aigc-observability-and-ops.md

  scripts/
    dev/
    migrate/
    seed/

  .env.example
  package.json
  pnpm-workspace.yaml
  turbo.json
```

## 应用分工

### apps/web

用户端 Web 应用。

技术栈：

```txt
Vue 3
TypeScript
Vite
Vue Router
Pinia
chadcn/vue
Tailwind CSS
```

主要职责：

- 用户登录、注册和账户信息展示。
- 生图、生视频、扩图、消除、超分等生成入口。
- Prompt 输入、参考图上传、参数选择。
- 任务列表、生成历史、作品库。
- 通过 HTTP 提交任务、取消任务、重试任务。
- 通过 SSE 接收任务状态、进度、完成、失败和额度变化。

### apps/admin

运营后台应用。

技术栈：

```txt
Vue 3
TypeScript
Vite
Vue Router
Pinia
Element Plus
```

主要职责：

- 用户管理、角色权限、运营账号。
- 任务查询、attempt 查询、失败原因排查。
- 模型配置、供应商配置、价格配置。
- 审核记录、人工复审、资源 blocked 管理。
- 计费流水、退款补偿、额度调整。
- 死信任务查询、重新投递、标记最终失败。

### apps/api

NestJS 主业务后端。

主要职责：

- 用户、权限、团队、项目。
- 任务创建、任务状态机、attempt 管理。
- 计费冻结、确认扣费、释放冻结、退款补偿。
- 资产元数据、作品库、签名 URL。
- 审核状态、风控记录、人工复审。
- RabbitMQ 任务发布、结果事件消费。
- SSE 状态推送。
- 运营后台 API。

NestJS 是业务最终状态源。任务状态、计费状态、资产归属和审核结论必须以 NestJS 落库结果为准。

### apps/ai-service

FastAPI AI 能力服务。

主要职责：

- 消费 RabbitMQ 任务。
- 适配 OpenAI、Replicate、Runway、火山、通义、可灵、即梦、ComfyUI、自研模型等能力。
- Prompt 翻译、优化、模板拼接、负向 Prompt 生成。
- 输入素材校验、压缩、裁剪、抽帧、mask 处理。
- 输出图片、视频的转码、压缩、水印、封面、预览图。
- 上传生成结果到 COS/OSS/S3。
- 接收供应商回调并转换为统一结果事件。

FastAPI 不应作为任务、计费和资产归属的最终状态源。

## 基础设施

推荐基础设施：

```txt
MySQL：核心业务数据库
Redis：缓存、限流、分布式锁、短期状态、SSE ticket
RabbitMQ：跨语言异步任务队列、结果事件、死信队列
COS/OSS/S3：用户上传素材、模型输入、生成结果、预览图、封面
```

整体链路：

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
模型供应商 / ComfyUI / 自研模型 / 媒体处理工具
```

## 数据库选型

当前项目推荐使用 MySQL。

原因：

- 中国团队和云服务环境中 MySQL 使用更普遍。
- 阿里云 RDS、腾讯云 TencentDB、华为云 RDS、PolarDB MySQL 等托管服务成熟。
- 运维、招聘、备份、迁移、读写分离和问题排查经验更容易获得。
- AIGC 核心业务主要是用户、任务、attempt、资产、计费流水、审核记录和运营查询，MySQL 8 可以稳定支撑。

推荐版本：

```txt
MySQL 8.0 或 MySQL 8.4 LTS
```

NestJS ORM 推荐：

```txt
Prisma + MySQL
```

使用原则：

- 常用查询条件必须设计为独立字段。
- 模型参数、供应商原始回调、原始错误等低频查询数据可以放 JSON 字段。
- 不要把任务状态、计费状态、用户 ID、模型、供应商、失败码等关键查询字段藏在 JSON 中。
- 所有核心状态变更必须有事务边界和幂等键。

## 核心数据表

建议核心业务表：

```txt
users
projects
generation_tasks
generation_task_attempts
assets
billing_transactions
moderation_records
audit_logs
provider_task_logs
```

### generation_tasks

任务主表，面向用户和业务状态。

核心字段：

```txt
id
user_id
project_id
type
model
status
stage
failure_code
billing_status
current_attempt_id
max_attempts
request_payload
created_at
updated_at
completed_at
```

### generation_task_attempts

任务执行轮次表，面向执行、重试和排障。

核心字段：

```txt
id
task_id
attempt_no
status
stage
provider
provider_task_id
failure_code
retryable
idempotency_key
request_payload_hash
raw_error
started_at
ended_at
created_at
updated_at
```

### assets

资产元数据表。

核心字段：

```txt
id
user_id
task_id
attempt_id
type
status
bucket
object_path
mime_type
size
width
height
duration
checksum
watermark_type
expires_at
deleted_at
created_at
updated_at
```

### billing_transactions

计费流水表。

核心字段：

```txt
id
user_id
task_id
attempt_id
type
amount
currency
status
idempotency_key
reason
operator_id
created_at
updated_at
```

## 共享包设计

### packages/shared-contracts

共享契约包，用于沉淀跨应用一致的协议。

建议包含：

```txt
任务状态枚举
任务阶段枚举
计费状态枚举
资产状态枚举
审核状态枚举
失败码
RabbitMQ exchange、queue、routing key
SSE event name
OpenAPI schema
AsyncAPI schema
```

TypeScript 应用可以直接引用类型。Python 服务建议通过 OpenAPI、JSON Schema 或 AsyncAPI 对齐契约，不强行共享运行时代码。

### packages/shared-config

共享工程配置。

建议包含：

```txt
eslint config
prettier config
tsconfig
tailwind preset
env schema
```

### packages/shared-ui

仅在确实出现跨 Web 和 Admin 的复用需求时再扩展。

注意：

- `apps/web` 使用 chadcn/vue。
- `apps/admin` 使用 Element Plus。
- 两套 UI 的组件风格和目标场景不同，不建议过早抽象大量通用业务组件。

### packages/shared-utils

只放纯工具函数，例如：

```txt
时间格式化
金额格式化
任务状态展示映射
错误码展示映射
```

不要把业务流程、数据库访问、队列发布等逻辑放入 shared-utils。

## 包管理与构建

推荐 Node.js 工作区工具：

```txt
pnpm workspace
Turborepo
```

推荐根目录脚本：

```txt
pnpm dev
pnpm dev:web
pnpm dev:admin
pnpm dev:api
pnpm build
pnpm lint
pnpm test
pnpm prisma:migrate
```

Python 的 FastAPI 服务可以放在 monorepo 内独立管理：

```txt
apps/ai-service/pyproject.toml
apps/ai-service/src/
apps/ai-service/tests/
```

Node.js 与 Python 不需要共用同一种包管理器，但需要共用接口契约和环境变量规范。

## 环境变量

根目录提供 `.env.example`，各应用可以有自己的本地环境文件。

建议分层：

```txt
.env.example
apps/web/.env.example
apps/admin/.env.example
apps/api/.env.example
apps/ai-service/.env.example
```

关键环境变量：

```txt
DATABASE_URL
REDIS_URL
RABBITMQ_URL
OBJECT_STORAGE_PROVIDER
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_REGION
OBJECT_STORAGE_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY
JWT_SECRET
SSE_TICKET_SECRET
```

生产环境不要在仓库中保存真实密钥。

## 开发启动顺序

本地开发推荐顺序：

```txt
1. 启动 MySQL、Redis、RabbitMQ、对象存储模拟服务。
2. 启动 apps/api。
3. 启动 apps/ai-service。
4. 启动 apps/web。
5. 启动 apps/admin。
```

最小闭环：

```txt
1. web 提交生成任务到 api。
2. api 校验参数、创建 generation_tasks 和 generation_task_attempts。
3. api 冻结额度。
4. api 发布 RabbitMQ 任务。
5. ai-service 消费任务并返回 mock 结果。
6. api 消费结果事件，更新任务、资产和计费状态。
7. web 通过 SSE 收到任务完成事件。
```

## 演进原则

- monorepo 管理代码和契约，不代表所有服务必须部署在同一个进程中。
- 早期可以用 Docker Compose 本地一键启动，后期再拆到 Kubernetes 或云托管服务。
- NestJS 与 FastAPI 保持清晰边界，避免互相直接修改对方内部状态。
- 共享包只共享稳定契约和纯工具，不共享复杂业务流程。
- 所有跨服务调用都必须带 `traceId`、`taskId`、`attemptId` 和 `idempotencyKey`。
- 运营后台能力要随着任务链路一起建设，不能等生产问题出现后再补。

## 最终建议

当前 AIGC 项目采用 monorepo 是合适的。代码仓库统一管理前端、后台、业务 API、AI 服务和部署配置；运行时仍按服务边界拆分。数据库选择 MySQL 更贴近中国团队和云服务生态，配合 Redis、RabbitMQ 和对象存储可以支撑第一阶段的生产架构。
