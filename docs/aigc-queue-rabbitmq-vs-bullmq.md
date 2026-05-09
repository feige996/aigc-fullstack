# AIGC 队列选型：RabbitMQ 与 BullMQ

## 结论

当前 AIGC 项目直接使用 RabbitMQ。

原因：

- 后端存在 NestJS 与 FastAPI 两种技术栈。
- FastAPI Worker 需要自然消费任务。
- 生图、生视频、音频、审核、后处理等 Worker 后续会按能力拆分。
- RabbitMQ 更适合跨语言、多服务、多消费者和复杂路由。
- 直接使用 RabbitMQ 可以减少未来从 BullMQ 迁移的成本。

## BullMQ

BullMQ 基于 Redis，适合 Node.js 生态中的异步任务队列。

优点：

- 和 NestJS 集成简单。
- 对 TypeScript 团队友好。
- 支持延迟任务、重试、优先级、并发、任务进度。
- 部署成本低，已有 Redis 时可以快速落地。
- 适合单业务线、单语言、Node Worker 为主的项目。

限制：

- 主要面向 Node.js Worker。
- Python FastAPI 直接消费 BullMQ 队列不自然。
- 跨语言、多消费者、复杂消息路由时扩展性不如 RabbitMQ 清晰。
- 后续如果 AI Worker 拆成 Python 服务，容易产生迁移成本。

适合链路：

```txt
NestJS 投递 BullMQ Job
NestJS Worker 消费 Job
NestJS Worker 调用 FastAPI
FastAPI 返回结果或回调 NestJS
```

## RabbitMQ

RabbitMQ 是通用消息队列，适合跨语言服务之间的任务分发和事件通知。

优点：

- Node.js、Python、Go、Java 都能自然接入。
- 支持 exchange、routing key、ack、dead letter、retry 等成熟消息模型。
- 适合任务分发、事件通知、跨服务解耦。
- 适合多个 AI Worker 按任务类型消费。
- 更适合中长期架构。

限制：

- 运维复杂度高于 BullMQ。
- 需要设计 exchange、queue、routing key、死信队列、重试策略。
- 早期开发成本略高。

适合链路：

```txt
NestJS 发布任务消息
FastAPI Worker 直接消费任务
FastAPI 发布任务结果消息
NestJS 消费结果并更新数据库
```

## 对比

| 维度 | BullMQ | RabbitMQ |
| --- | --- | --- |
| 底层依赖 | Redis | RabbitMQ |
| 主要生态 | Node.js | 多语言 |
| NestJS 集成 | 简单 | 成熟，但配置更多 |
| FastAPI 集成 | 不自然 | 自然 |
| 多消费者 | 支持，但偏任务队列模型 | 强 |
| 复杂路由 | 较弱 | 强 |
| 死信队列 | 可做，但不如 RabbitMQ 原生 | 原生支持 |
| 延迟任务 | 方便 | 需要插件或设计延迟队列 |
| 运维复杂度 | 较低 | 较高 |
| 未来扩展 | 中等 | 更强 |

## 推荐 RabbitMQ 设计

Exchange：

```txt
generation.request
generation.result
generation.dead-letter
```

Queue：

```txt
image.generate.queue
video.generate.queue
image.upscale.queue
image.inpaint.queue
generation.result.persist.queue
generation.failed.queue
```

Routing key：

```txt
image.generate
video.generate
image.upscale
image.inpaint
task.succeeded
task.failed
```

消息流：

```txt
NestJS -> generation.request -> image.generate.queue -> FastAPI image worker
NestJS -> generation.request -> video.generate.queue -> FastAPI video worker
FastAPI -> generation.result -> generation.result.persist.queue -> NestJS
失败消息 -> generation.dead-letter -> generation.failed.queue
```

## 数据一致性原则

- NestJS 是任务最终状态源。
- RabbitMQ 只负责任务分发和结果事件，不作为业务数据库。
- FastAPI Worker 消费消息后必须 ack 或 nack。
- 消息体必须包含 `taskId`、`idempotencyKey`、`attempt`。
- NestJS 处理结果消息必须幂等。
- 失败任务需要区分可重试失败和不可重试失败。
- 死信队列中的任务需要后台可查询、可重试、可人工处理。

## 重试与死信建议

RabbitMQ 的重试状态不应直接等同于业务状态。业务状态仍由 NestJS 落库维护。

推荐规则：

- Worker 消费失败且可重试：消息进入延迟重试队列，NestJS 将任务标记为 `failed` 或 `retrying`。
- Worker 消费失败且不可重试：发布失败结果事件，NestJS 将任务标记为 `final_failed` 或 `rejected`。
- 达到最大重试次数：消息进入死信队列，NestJS 将任务标记为 `final_failed`。
- 死信队列只代表消息层面已无法继续自动处理，不直接作为用户可见状态。

建议保留执行轮次：

```txt
taskId：业务任务 ID
attemptId：单次执行 ID
attempt：当前第几次执行
maxAttempts：最大执行次数
idempotencyKey：幂等键
```

可自动重试错误：

```txt
WORKER_TIMEOUT
PROVIDER_TIMEOUT
PROVIDER_RATE_LIMITED
MEDIA_PROCESS_FAILED
ASSET_UPLOAD_FAILED
CALLBACK_FAILED
```

不可自动重试错误：

```txt
PROMPT_SENSITIVE
TEXT_MODERATION_REJECTED
ASSET_MODERATION_REJECTED
RESULT_MODERATION_REJECTED
QUOTA_NOT_ENOUGH
INPUT_INVALID
USER_CANCELED
```

## 最终选择

当前项目直接使用 RabbitMQ。

BullMQ 不作为主任务队列引入，避免后续跨语言 Worker 扩展时迁移。
