# AIGC AI 服务与 Monorepo 边界决策

## 结论

当前项目继续采用 monorepo 管理 AI 服务代码，但 AI 服务必须保持独立运行和独立部署。

推荐方式：

- `apps/ai-service` 继续放在当前 monorepo 中。
- `apps/api` 与 `apps/ai-service` 是两个独立服务，不合并为一个运行进程。
- NestJS API 作为主业务状态源，负责用户、任务、计费、资产和运营后台。
- FastAPI AI 服务作为能力执行层，负责模型适配、Prompt 处理、媒体处理、供应商回调和 Worker 执行。
- 两者通过 RabbitMQ、HTTP 或回调通信，不共享运行时内存，不互相直接调用内部实现。

一句话原则：

```txt
代码仓库可以放一起，服务边界必须拆开。
```

## 背景

本项目是 AIGC 全栈系统，当前包含：

```txt
apps/
  web/          用户端 Vue 应用
  admin/        运营后台 Vue 应用
  api/          NestJS 主业务后端
  ai-service/   FastAPI AI 服务和 Worker

packages/
  shared-contracts/  共享队列名、事件名、消息结构和业务枚举
  shared-config/     共享 TypeScript 工具配置
  shared-utils/      共享纯工具函数

infra/
  compose/      本地基础设施

docs/           架构和工程设计文档
```

系统核心链路：

```txt
Web / Admin
  |
  | HTTP / SSE
  v
NestJS API
  |
  | RabbitMQ
  v
FastAPI AI Worker
  |
  | SDK / HTTP / Workflow
  v
模型供应商 / ComfyUI / 自研模型 / 媒体处理工具
```

## 术语约定

本文档首次出现关键术语时使用中文 + 英文对照，后续按语境使用中文或英文。

- 单仓库（Monorepo）
- 主业务状态源（Source of Truth）
- 服务边界（Service Boundary）
- 异步任务队列（Async Job Queue）
- 消息队列（Message Queue）
- 路由键（Routing Key）
- 死信队列（Dead Letter Queue, DLQ）
- 幂等键（Idempotency Key）
- 执行轮次（Attempt）
- 故障域（Failure Domain）
- 工作进程（Worker）

## 为什么 AI 服务代码放在 monorepo

### 契约可以同步演进

AIGC 系统中，业务 API 和 AI Worker 之间存在大量共享契约：

- RabbitMQ exchange、queue、routing key。
- 任务请求消息结构。
- 任务结果消息结构。
- 任务状态、阶段、失败码。
- 资产输出字段。
- 幂等键、执行轮次和 trace 字段。

这些契约一旦不一致，会导致任务无法消费、结果无法落库、状态无法推送或计费异常。

放在同一个 monorepo 中，开发者修改一次任务链路时，可以同时调整：

- `apps/api`
- `apps/ai-service`
- `packages/shared-contracts`
- 相关文档和本地基础设施

这比跨多个仓库提交、发布、升级版本更直接，也更适合当前项目仍在快速迭代的阶段。

### 早期迭代成本更低

当前阶段，模型参数、生成类型、任务状态、计费规则、资产结构和审核流程都会持续变化。

monorepo 可以降低这些变化的协调成本：

- 本地联调更简单。
- 端到端 mock 流程更容易维护。
- 架构文档、API、Worker 和基础设施配置可以一起更新。
- CI 可以基于路径只跑受影响的检查。
- 新开发者只需要拉一个仓库就能理解完整链路。

### 架构文档和工程约定集中

AIGC 系统的正确性不只在单个服务内部，还依赖服务之间的状态流转。

例如：

- NestJS 创建任务后发布队列消息。
- FastAPI Worker 消费任务并执行模型调用。
- FastAPI 发送结果事件。
- NestJS 消费结果事件并更新 MySQL。
- NestJS 通过 SSE 推送前端。

这些设计放在同一个仓库中，有助于后续开发者看到完整上下文，避免只理解局部服务而破坏整体一致性。

## 为什么 AI 服务运行上必须独立

虽然代码放在同一个仓库，但 `apps/api` 和 `apps/ai-service` 不能合并成一个服务。

### 技术栈不同

`apps/api` 使用：

```txt
NestJS
TypeScript
Prisma
MySQL
JWT / RBAC
SSE
```

`apps/ai-service` 使用：

```txt
FastAPI
Python
Pydantic
模型 SDK
媒体处理工具
Worker runtime
```

两者的依赖模型、运行方式、部署镜像和性能瓶颈都不同。强行合并会让主业务服务承担大量 AI 执行依赖，增加启动成本、镜像体积和故障风险。

### 故障域（Failure Domain）不同

AI 服务常见问题包括：

- 模型供应商超时。
- 第三方限流。
- GPU Worker 繁忙。
- ComfyUI 工作流失败。
- 图片或视频转码失败。
- 大文件下载、上传失败。
- 单个任务执行时间很长。

这些问题不应该影响用户登录、任务查询、资产列表、运营后台和计费记录。

因此 AI 服务必须作为独立进程运行，主业务 API 通过队列和状态机隔离故障。

### 扩缩容方式不同

`apps/api` 通常按 HTTP 请求量扩容。

`apps/ai-service` 通常按任务类型、队列积压、模型耗时、GPU 资源或供应商限流情况扩容。

例如：

```txt
image.generate.queue   -> 多个图片生成 Worker
video.generate.queue   -> 少量视频生成 Worker
image.upscale.queue    -> 独立超分 Worker
image.inpaint.queue    -> 独立局部重绘 Worker
```

如果两者运行在同一个服务中，将难以按不同负载独立扩容。

### 数据最终状态必须由业务后端控制

NestJS API 是业务最终状态源。

以下状态必须以 NestJS 落库为准：

- 任务状态。
- attempt 状态。
- 计费冻结、确认、释放、退款。
- 资产归属。
- 审核结论。
- 用户权限和资源访问控制。

FastAPI AI 服务可以产生执行结果，但不应该直接决定核心业务最终状态。

推荐规则：

```txt
AI 服务负责执行，业务 API 负责确认和落库。
```

## 当前推荐边界

### NestJS API 职责

`apps/api` 负责：

- 用户注册、登录、鉴权。
- 用户、角色、权限、运营后台。
- 任务创建、取消、重试、查询。
- 任务状态机和 attempt 管理。
- 积分、套餐、计费冻结和确认。
- 资产元数据、作品库、签名 URL。
- 审核状态和风控记录。
- RabbitMQ 任务发布。
- RabbitMQ 结果事件消费。
- SSE 状态推送。

NestJS 可以调用 AI 服务的短耗时同步接口，但不能把长耗时模型任务放进 HTTP 同步链路。

适合同步调用的能力：

- Prompt 优化。
- Prompt 翻译。
- 参数预估。
- 模型列表。
- 健康检查。
- 图片基础信息识别。

### FastAPI AI 服务职责

`apps/ai-service` 负责：

- 消费 RabbitMQ 任务。
- 适配模型供应商和自研模型。
- Prompt 翻译、优化、模板拼接。
- 输入素材校验、裁剪、压缩、抽帧、mask 处理。
- 图片、视频、音频后处理。
- 上传生成结果到对象存储。
- 接收供应商回调并转换为统一结果事件。
- 发布任务执行结果。
- 暴露 AI 服务健康检查和模型可用性信息。

FastAPI 不负责：

- 用户权限最终判断。
- 积分和订单最终状态。
- 任务最终状态落库。
- 资产归属最终判断。
- 运营后台业务查询。

## 推荐通信方式

### 长耗时任务使用 RabbitMQ

适合：

- 生图。
- 生视频。
- 超分。
- 扩图。
- 局部重绘。
- 批量生成。
- 视频转码。
- 大文件处理。

推荐链路：

```txt
1. Frontend 提交任务到 NestJS。
2. NestJS 校验登录态、权限、参数和额度。
3. NestJS 创建 generation_task 和 generation_task_attempt。
4. NestJS 冻结或预扣额度。
5. NestJS 发布任务消息到 RabbitMQ。
6. FastAPI Worker 消费任务。
7. FastAPI 执行模型调用和媒体处理。
8. FastAPI 发布结果事件。
9. NestJS 消费结果事件，更新任务、资产和计费状态。
10. NestJS 通过 SSE 推送前端。
```

### 短耗时能力可以使用 HTTP

适合：

- Prompt 改写。
- Prompt 翻译。
- 参数检查。
- 模型能力查询。
- 健康检查。

推荐链路：

```txt
Frontend -> NestJS -> FastAPI -> NestJS -> Frontend
```

前端不直接调用 FastAPI。所有用户态请求优先经过 NestJS，以便统一鉴权、限流、审计和错误格式。

## 共享契约原则

### TypeScript 与 Python 契约必须保持一致

当前 TypeScript 契约位于：

```txt
packages/shared-contracts/src/index.ts
```

Python 契约位于：

```txt
apps/ai-service/src/contracts.py
```

短期可以手动维护两边结构，但每次修改必须同步检查：

- 字段名是否一致。
- camelCase / snake_case alias 是否一致。
- 必填和可选字段是否一致。
- 状态枚举是否一致。
- 错误码是否一致。
- 队列名和 routing key 是否一致。

中长期建议引入单一契约源，例如：

- JSON Schema。
- OpenAPI schema。
- Protobuf。
- AsyncAPI。

由 schema 生成 TypeScript 和 Python 类型，减少人工维护不一致的风险。

### 不共享业务实现

`packages/shared-*` 只能放稳定、无副作用、跨应用确实需要共享的内容。

适合共享：

- 消息结构。
- 枚举。
- 队列名。
- 事件名。
- 纯工具函数。
- TypeScript 编译配置。

不适合共享：

- NestJS Service。
- Prisma 访问逻辑。
- FastAPI Worker 执行逻辑。
- 供应商 SDK 封装实现。
- 带数据库、Redis、HTTP 副作用的业务逻辑。

共享契约可以减少重复，跨服务共享实现会增加耦合。

## CI/CD 建议

monorepo 不代表所有内容必须一起构建和部署。

推荐按路径拆分检查和部署：

```txt
apps/web/**          -> Web 构建和部署
apps/admin/**        -> Admin 构建和部署
apps/api/**          -> API 测试、镜像构建和部署
apps/ai-service/**   -> AI 服务测试、镜像构建和部署
packages/**          -> 触发受影响应用检查
infra/**             -> 基础设施检查
docs/**              -> 文档检查
```

AI 服务应该有独立的：

- Python 依赖锁定。
- Ruff / pytest 检查。
- Dockerfile。
- 镜像版本。
- 环境变量。
- 部署配置。
- 运行监控。

API 服务也应该有独立的：

- TypeScript 类型检查。
- NestJS 测试。
- Prisma migration 检查。
- Dockerfile。
- 镜像版本。
- 部署配置。

## 什么时候考虑拆出独立仓库

当前阶段不建议拆。

只有当以下信号持续出现时，才考虑把 AI 服务拆成独立仓库：

- 算法团队和业务团队已经明显分离，发布节奏完全不同。
- AI 服务有大量模型代码、训练代码、GPU 调度脚本或模型权重管理逻辑。
- AI 服务需要被多个业务系统复用，而不只是服务当前 AIGC 产品。
- 供应商密钥、模型权重或内部算法资产需要更严格的代码访问隔离。
- AI 服务 CI/CD 已经明显拖慢整个 monorepo。
- AI 服务版本需要长期独立发布、回滚和兼容多个业务 API 版本。
- AI 服务已经形成平台能力，需要对多个上游提供稳定 API。

拆出独立仓库后，也必须保留明确契约：

- 使用 schema 或 SDK 版本管理。
- RabbitMQ 消息结构需要版本化。
- API 与 AI 服务之间需要兼容策略。
- 不能靠口头约定同步字段。

## 什么时候不应该拆

以下情况不建议拆出独立仓库：

- 只是因为技术栈不同。
- 只是因为目录看起来多。
- 只是因为未来可能会复杂。
- 只是因为 AI 服务需要独立部署。
- 只是因为有 Python 和 TypeScript 两套依赖。

这些问题可以通过 monorepo 内部的服务边界、独立镜像、独立 CI job 和清晰契约解决，不需要拆仓库。

## 开发者修改规则

修改任务链路时，必须检查：

- `apps/api` 是否需要调整发布消息或消费结果。
- `apps/ai-service` 是否需要调整消费消息或返回结果。
- `packages/shared-contracts` 是否需要调整枚举、队列名或消息类型。
- Prisma schema 和 migration 是否需要调整。
- SSE 事件是否需要调整。
- 相关文档是否需要更新。

修改 AI 服务时，必须避免：

- 直接写核心业务数据库。
- 绕过 NestJS 判断用户权限。
- 在 Worker 中决定最终计费状态。
- 把长耗时任务暴露为前端同步 HTTP 请求。
- 把供应商原始状态直接暴露给前端。

修改 API 服务时，必须避免：

- 把模型供应商细节扩散到前端接口。
- 在 HTTP 请求中等待长耗时生成任务完成。
- 绕过 attempt 和幂等模型直接更新任务状态。
- 让任务状态只存在于队列或 Worker 内存中。

## 最终原则

当前项目采用：

```txt
monorepo 管代码
独立服务管运行
RabbitMQ 管异步解耦
NestJS 管业务最终状态
FastAPI 管 AI 执行能力
共享契约管跨服务一致性
```

在没有明确组织、权限、复用和发布复杂度信号之前，AI 服务不需要拆出独立仓库。
