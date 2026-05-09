# AIGC 后端架构分工：NestJS 与 FastAPI

## 目标

本文档用于说明 AIGC 生图、生视频项目中，NestJS 与 FastAPI 的职责边界、服务交互方式，以及 RabbitMQ 与 SSE 的落地方式。

推荐结论：

- NestJS 作为主业务后端，负责用户、权限、计费、任务状态、作品资产、运营后台等业务闭环。
- FastAPI 作为 AI 能力服务，负责模型适配、媒体处理、任务执行、回调处理、Prompt 处理和审核能力。
- RabbitMQ 作为跨语言任务队列，NestJS 发布任务，FastAPI Worker 消费任务。
- SSE 作为前端任务状态推送通道，提交、取消、重试等操作仍走 HTTP API。

## 总体架构

```txt
Frontend
  |
  | HTTP / SSE
  v
NestJS 主业务后端
  |
  | HTTP / RabbitMQ / Callback
  v
FastAPI AI 能力服务
  |
  | SDK / HTTP / Workflow
  v
模型供应商 / ComfyUI / 自研模型 / 媒体处理工具

MySQL：核心业务数据
RabbitMQ：跨语言任务队列、结果事件、死信与重试隔离
Redis：缓存、分布式锁、短期状态
COS/S3/OSS：图片、视频、参考图、生成结果
```

## NestJS 职责

NestJS 是主业务系统入口，负责和用户、订单、权限、任务状态强相关的逻辑。

### 用户与权限

- 登录、注册、Token 刷新。
- 用户资料、企业、团队、角色、权限。
- 管理后台 RBAC。
- 接口鉴权、资源归属校验。

### 会员、积分与计费

- 套餐、会员权益、生成额度。
- 积分扣减、冻结、退款。
- 订单、支付、发票。
- 不同模型、清晰度、时长、分辨率的计费规则。

### AIGC 任务状态

- 创建生图、生视频、扩图、消除、超分等任务。
- 维护任务主状态、执行阶段、失败原因、重试次数。
- 记录任务参数、模型、用户、项目、作品归属。
- 控制任务取消、重试、超时、失败退款。
- 向前端提供任务详情、任务列表、生成历史。

### 资产与作品库

- 管理用户上传素材。
- 管理 AI 生成结果。
- 维护 COS/S3 对象信息、封面、预览图、源文件。
- 作品收藏、删除、移动、项目关联。
- 资源访问权限与签名 URL。

### 前端实时状态

- 前端轮询接口。
- SSE 推送任务进度、完成通知、失败通知、额度变化通知。
- 统一返回业务状态，不暴露底层模型供应商细节。

### 运营后台

- 模型配置管理。
- 用户任务查询。
- 失败任务重试。
- 成本、用量、耗时、失败率统计。
- 第三方供应商额度与调用记录。

## FastAPI 职责

FastAPI 作为 AI 能力服务，负责模型和媒体相关逻辑。它不应承担主业务的最终状态源。

### 模型适配

统一封装不同模型或平台的调用差异：

- OpenAI、Replicate、Runway、火山、通义、可灵、即梦等第三方模型。
- ComfyUI、Stable Diffusion、Flux 等自建工作流。
- 内部自研图像、视频、音频模型。

FastAPI 对 NestJS 暴露统一接口，例如：

```http
POST /v1/image/generate
POST /v1/video/generate
POST /v1/image/upscale
POST /v1/image/inpaint
POST /v1/image/remove-background
GET /v1/tasks/{externalTaskId}
```

### 参数转换

NestJS 保存统一业务参数，FastAPI 转换为具体模型参数：

```txt
业务参数：
model、prompt、ratio、duration、style、seed、referenceImages

模型参数：
workflow JSON、negative_prompt、width、height、steps、cfg、provider-specific payload
```

### 媒体预处理

- 上传图格式校验。
- 图片压缩、裁剪、缩略图。
- 参考图尺寸转换。
- mask 生成。
- 视频抽帧、封面生成。
- 输入文件安全检查。

### 媒体后处理

- 图片转码、压缩、加水印。
- 视频转码、码率压缩、封面生成。
- 视频拼接、音频分离、字幕合成。
- 结果文件上传 COS/S3/OSS。
- 返回标准化资源信息给 NestJS。

### Prompt 能力

- Prompt 翻译。
- Prompt 优化。
- 风格模板拼接。
- 负向 Prompt 生成。
- 敏感词检测。
- 文本安全审核。

### 回调处理

不同模型供应商回调格式不一致，FastAPI 负责适配：

- 接收供应商回调。
- 校验签名。
- 下载生成结果。
- 上传对象存储。
- 转换为统一结果格式。
- 回调 NestJS 更新业务任务。

### AI 服务健康检查

- 模型可用性。
- GPU Worker 在线状态。
- ComfyUI 队列长度。
- 第三方模型失败率。
- 平均耗时、超时率。
- 供应商额度或限流状态。

## 交互方式

### 推荐链路

```txt
1. 前端提交生成请求到 NestJS。
2. NestJS 校验登录态、权限、积分、套餐、参数合法性。
3. NestJS 创建 generation_task 记录，状态为 pending。
4. NestJS 冻结或预扣积分。
5. NestJS 发布任务消息到 RabbitMQ。
6. FastAPI Worker 消费 RabbitMQ 任务。
7. FastAPI 执行模型调用、媒体处理、结果上传。
8. FastAPI 发布结果消息，或回调 NestJS。
9. NestJS 更新任务状态、资产记录、计费结果。
10. NestJS 通过 SSE 向前端推送最终状态。
```

### 同步接口适用场景

适合耗时短、可快速返回的能力：

- Prompt 优化。
- Prompt 翻译。
- 参数预估。
- 模型列表。
- 图片基础信息识别。
- 健康检查。

示例：

```txt
Frontend -> NestJS -> FastAPI -> NestJS -> Frontend
```

### 异步任务适用场景

适合耗时长、可能失败、需要排队的能力：

- 生图。
- 生视频。
- 视频转码。
- 超分。
- 批量生成。
- 大文件处理。

示例：

```txt
Frontend -> NestJS -> RabbitMQ -> FastAPI Worker -> Result Event / Callback -> NestJS -> SSE -> Frontend
```

## SSE 推送方案

前端任务状态推送统一使用 SSE。HTTP 负责提交、取消、重试、查询详情；SSE 只负责服务端向前端推送状态变化。

```txt
提交任务：POST /api/generation/tasks
取消任务：POST /api/generation/tasks/{taskId}/cancel
重试任务：POST /api/generation/tasks/{taskId}/retry
任务详情：GET /api/generation/tasks/{taskId}
状态推送：GET /api/generation/tasks/events
```

SSE 事件建议：

```txt
task.queued
task.running
task.progress
task.succeeded
task.failed
task.canceled
quota.updated
```

示例：

```txt
event: task.progress
data: {"taskId":"task_123","status":"running","progress":40}

event: task.succeeded
data: {"taskId":"task_123","status":"succeeded","outputs":[...]}
```

鉴权建议：

- 优先使用 Cookie 鉴权，便于浏览器原生 `EventSource` 建连。
- 如果使用 Token 鉴权，建议前端先通过 HTTP 获取短期 SSE ticket，再连接 `/events?ticket=xxx`。
- 不要把长期访问 Token 放到 URL 参数中。

SSE 与 WebSocket 的详细对比见：[AIGC 实时推送选型：SSE 与 WebSocket](./aigc-realtime-sse-vs-websocket.md)。

## API 契约建议

NestJS 调用 FastAPI 时，应传递业务任务 ID 与幂等 ID。

```json
{
  "taskId": "task_123",
  "idempotencyKey": "task_123_attempt_1",
  "userId": "user_001",
  "model": "video_v1",
  "type": "text_to_video",
  "input": {
    "prompt": "cinematic city night",
    "ratio": "16:9",
    "duration": 5
  },
  "assets": {
    "referenceImages": []
  },
  "callbackUrl": "https://api.example.com/internal/ai/callback"
}
```

FastAPI 回调 NestJS 时，应返回标准化结果：

```json
{
  "taskId": "task_123",
  "status": "succeeded",
  "provider": "provider_name",
  "externalTaskId": "provider_task_456",
  "outputs": [
    {
      "type": "video",
      "cosPath": "aigc/output/task_123/result.mp4",
      "previewUrl": "https://cdn.example.com/preview/task_123.mp4",
      "coverCosPath": "aigc/output/task_123/cover.jpg",
      "width": 1280,
      "height": 720,
      "duration": 5
    }
  ],
  "usage": {
    "cost": 20,
    "unit": "credits"
  },
  "error": null
}
```

失败回调：

```json
{
  "taskId": "task_123",
  "status": "failed",
  "provider": "provider_name",
  "externalTaskId": "provider_task_456",
  "outputs": [],
  "usage": null,
  "error": {
    "code": "PROVIDER_TIMEOUT",
    "message": "provider task timeout",
    "retryable": true
  }
}
```

## RabbitMQ 任务方案

任务队列统一使用 RabbitMQ，避免后续从 Node 专用队列迁移到跨语言消息队列。

推荐职责：

- NestJS 创建业务任务，写入 MySQL。
- NestJS 发布生成任务消息到 RabbitMQ。
- FastAPI Worker 按任务类型或模型类型消费消息。
- FastAPI Worker 调用模型、处理媒体、上传结果。
- FastAPI 发布结果消息，或通过 HTTP 回调 NestJS。
- NestJS 消费结果并更新任务状态、计费、资产。

推荐消息流：

```txt
generation.request exchange
  -> image.generate queue
  -> video.generate queue
  -> image.upscale queue
  -> image.inpaint queue

generation.result exchange
  -> generation.result.persist queue

generation.dead-letter exchange
  -> generation.failed queue
```

RabbitMQ 与 BullMQ 的详细对比见：[AIGC 队列选型：RabbitMQ 与 BullMQ](./aigc-queue-rabbitmq-vs-bullmq.md)。

### 不推荐的方式

不建议让 FastAPI 直接成为业务任务状态源：

```txt
Frontend -> FastAPI -> 模型 -> FastAPI 数据库
```

问题：

- 用户权限和任务归属容易分散。
- 计费、退款、状态一致性难处理。
- 作品库与业务数据库容易割裂。
- 前端需要理解多个后端状态。

也不建议早期同时引入太多中间件：

```txt
RabbitMQ + Kafka + Celery + 多套 Worker
```

除非已经有明确规模和组织需求，否则会增加维护成本。

## 数据一致性建议

NestJS 应作为任务最终状态源。

关键原则：

- 任务创建、用户归属、计费状态写在 NestJS 业务库。
- FastAPI 只保存必要的执行日志、外部任务 ID、临时状态。
- FastAPI 回调必须幂等。
- NestJS 更新任务状态也必须幂等。
- 失败任务需要区分可重试失败和不可重试失败。
- 积分扣减建议使用冻结、确认扣费、失败释放三阶段。

### 状态模型

不建议把所有情况都塞进一个 `status` 枚举。AIGC 任务建议拆成四类字段：

```txt
status：主状态，用于前端列表、筛选、业务判断
stage：执行阶段，用于展示当前卡在哪一步
failureCode：失败原因，用于提示、退款、重试策略
retry：重试信息，用于判断是否可自动重试或手动重试
```

推荐字段：

```ts
type GenerationTaskStatus =
  | 'draft'
  | 'validating'
  | 'rejected'
  | 'pending'
  | 'queued'
  | 'running'
  | 'retrying'
  | 'succeeded'
  | 'failed'
  | 'final_failed'
  | 'canceled'
  | 'expired'

type GenerationTaskStage =
  | 'input_validation'
  | 'text_moderation'
  | 'asset_moderation'
  | 'quota_check'
  | 'billing_freeze'
  | 'queue_publish'
  | 'model_dispatch'
  | 'model_waiting'
  | 'model_generating'
  | 'result_fetching'
  | 'media_processing'
  | 'result_moderation'
  | 'asset_uploading'
  | 'billing_confirm'
  | 'completed'
```

主状态说明：

| 状态 | 含义 | 是否终态 | 是否可重试 |
| --- | --- | --- | --- |
| `draft` | 任务草稿或待提交 | 否 | 否 |
| `validating` | 参数、权限、额度、审核校验中 | 否 | 否 |
| `rejected` | 提交前被拒绝，例如敏感词、参数非法、素材审核不通过 | 是 | 否 |
| `pending` | 业务任务已创建，等待入队 | 否 | 是 |
| `queued` | 已进入 RabbitMQ，等待 Worker 消费 | 否 | 是 |
| `running` | Worker 已消费，模型或媒体处理执行中 | 否 | 是 |
| `retrying` | 自动重试或人工重试已触发，等待再次执行 | 否 | 是 |
| `succeeded` | 生成成功，结果已入库，计费确认完成 | 是 | 否 |
| `failed` | 单次执行失败，但仍可重试 | 否 | 是 |
| `final_failed` | 达到重试上限或不可恢复失败 | 是 | 否 |
| `canceled` | 用户或系统取消任务 | 是 | 否 |
| `expired` | 长时间无结果，任务过期关闭 | 是 | 可按业务决定 |

### 失败原因

失败原因建议使用 `failureCode`，不要直接从 `status` 推断。

推荐分类：

```txt
INPUT_INVALID：参数非法
PROMPT_SENSITIVE：Prompt 敏感词命中
TEXT_MODERATION_REJECTED：文本审核失败
ASSET_MODERATION_REJECTED：上传素材审核失败
RESULT_MODERATION_REJECTED：生成结果审核失败
QUOTA_NOT_ENOUGH：额度不足
BILLING_FREEZE_FAILED：积分冻结失败
QUEUE_PUBLISH_FAILED：队列投递失败
WORKER_TIMEOUT：Worker 执行超时
PROVIDER_TIMEOUT：模型供应商超时
PROVIDER_RATE_LIMITED：模型供应商限流
PROVIDER_REJECTED：模型供应商拒绝
PROVIDER_FAILED：模型供应商返回失败
MEDIA_PROCESS_FAILED：媒体处理失败
ASSET_UPLOAD_FAILED：结果上传失败
CALLBACK_FAILED：结果回调失败
BILLING_CONFIRM_FAILED：确认扣费失败
USER_CANCELED：用户取消
SYSTEM_CANCELED：系统取消
UNKNOWN_ERROR：未知错误
```

失败类型建议：

```txt
business_rejected：业务拒绝，不进入模型执行
moderation_rejected：审核拒绝，不允许重试原参数
transient_failed：临时失败，可自动重试
provider_failed：供应商失败，按错误码决定是否重试
system_failed：系统失败，可自动重试或人工处理
final_failed：最终失败，不再自动重试
```

### 审核失败与敏感词失败

敏感词和审核失败不建议使用普通 `failed`。

提交前失败：

```txt
validating -> rejected
failureCode = PROMPT_SENSITIVE | TEXT_MODERATION_REJECTED | ASSET_MODERATION_REJECTED
```

含义：

- 未进入模型执行。
- 不应扣费，已冻结额度需要释放。
- 前端展示为“审核未通过”或“内容不符合规范”。
- 用户修改 Prompt 或素材后重新提交新任务。

生成后审核失败：

```txt
running -> final_failed
stage = result_moderation
failureCode = RESULT_MODERATION_REJECTED
```

含义：

- 模型已经生成结果，但结果不能对用户展示。
- 是否扣费按业务策略决定，建议默认不扣或走特殊成本策略。
- 不建议自动重试同一参数，避免反复生成违规内容。

### 重试设计

重试要区分自动重试和手动重试。

推荐字段：

```ts
interface RetryInfo {
  attempt: number
  maxAttempts: number
  nextRetryAt?: string
  lastFailureCode?: string
  retryable: boolean
  retryMode?: 'auto' | 'manual'
}
```

自动重试适合：

- `WORKER_TIMEOUT`
- `PROVIDER_TIMEOUT`
- `PROVIDER_RATE_LIMITED`
- `QUEUE_PUBLISH_FAILED`
- `MEDIA_PROCESS_FAILED`
- `ASSET_UPLOAD_FAILED`
- `CALLBACK_FAILED`

不建议自动重试：

- `PROMPT_SENSITIVE`
- `TEXT_MODERATION_REJECTED`
- `ASSET_MODERATION_REJECTED`
- `RESULT_MODERATION_REJECTED`
- `QUOTA_NOT_ENOUGH`
- `USER_CANCELED`
- 明确的参数非法 `INPUT_INVALID`

重试流转：

```txt
running -> failed -> retrying -> queued -> running -> succeeded
running -> failed -> retrying -> queued -> running -> final_failed
queued -> failed -> retrying -> queued
```

达到重试上限：

```txt
failed -> final_failed
```

人工重试建议创建新的执行轮次，不要覆盖原始失败记录：

```txt
task_id：业务任务 ID
attempt_id：执行轮次 ID
attempt：第几次执行
```

### 推荐状态流转

正常成功：

```txt
draft -> validating -> pending -> queued -> running -> succeeded
```

提交前审核失败：

```txt
draft -> validating -> rejected
```

额度不足：

```txt
draft -> validating -> rejected
failureCode = QUOTA_NOT_ENOUGH
```

执行中临时失败后自动重试成功：

```txt
pending -> queued -> running -> failed -> retrying -> queued -> running -> succeeded
```

执行中临时失败并达到重试上限：

```txt
pending -> queued -> running -> failed -> retrying -> queued -> running -> final_failed
```

生成结果审核失败：

```txt
pending -> queued -> running -> final_failed
failureCode = RESULT_MODERATION_REJECTED
```

用户取消：

```txt
pending -> canceled
queued -> canceled
running -> canceled
```

超时过期：

```txt
queued -> expired
running -> expired
```

### 前端展示建议

前端列表建议主要使用 `status` 展示：

- `rejected`：审核未通过、参数不合法、额度不足。
- `failed`：生成失败，允许用户重试。
- `final_failed`：生成失败，已达重试上限或不可恢复。
- `expired`：任务超时。

详情页再展示 `stage` 和 `failureCode` 对应的精确文案。

不要直接把底层供应商错误信息展示给用户，应由 NestJS 映射为稳定的业务错误码和用户文案。

## 目录与模块建议

### NestJS

```txt
src/modules/auth
src/modules/user
src/modules/billing
src/modules/generation
src/modules/asset
src/modules/model
src/modules/notification
src/modules/admin
src/modules/internal-ai
src/queues/generation
```

### FastAPI

```txt
app/api
app/adapters
app/adapters/providers
app/adapters/comfyui
app/services/media
app/services/prompt
app/services/moderation
app/workers
app/callbacks
app/storage
app/schemas
```

## 最终建议

当前阶段建议采用：

```txt
NestJS 作为主业务后端
FastAPI 作为 AI 能力服务
RabbitMQ 作为跨语言任务队列
MySQL 作为主数据库
COS/S3/OSS 作为资源存储
SSE 作为前端任务状态推送
```

任务主链路：

```txt
Frontend -> HTTP -> NestJS -> RabbitMQ -> FastAPI Worker -> RabbitMQ/Callback -> NestJS -> SSE -> Frontend
```

简单结论：主业务状态归 NestJS，AI 执行归 FastAPI，任务分发用 RabbitMQ，前端状态推送用 SSE。

## 延伸设计文档

- [AIGC 任务与计费一致性设计](./aigc-billing-consistency.md)
- [AIGC 幂等与 Attempt 执行模型](./aigc-idempotency-and-attempt.md)
- [AIGC 资源生命周期与存储规范](./aigc-asset-lifecycle-and-storage.md)
- [AIGC 审核与风控策略](./aigc-moderation-and-risk-control.md)
- [AIGC 可观测性与运营后台能力](./aigc-observability-and-ops.md)
- [AIGC 实时推送选型：SSE 与 WebSocket](./aigc-realtime-sse-vs-websocket.md)
- [AIGC 队列选型：RabbitMQ 与 BullMQ](./aigc-queue-rabbitmq-vs-bullmq.md)
