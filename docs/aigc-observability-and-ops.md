# AIGC 可观测性与运营后台能力

## 目标

AIGC 任务链路长、供应商多、失败原因复杂。必须提前设计可观测性和运营后台能力，避免生产问题只能查库、查日志或手动改数据。

核心原则：

- 每个任务必须可追踪。
- 每个 attempt 必须可排障。
- 每个失败必须有稳定错误码。
- 运营后台必须支持查询、重试、退款、补偿和死信处理。

## 追踪字段

所有日志、消息、回调、数据库记录建议包含：

```txt
traceId
taskId
attemptId
userId
projectId
model
provider
providerTaskId
stage
status
failureCode
idempotencyKey
```

最小基线建议：

- HTTP 请求统一透传 `x-request-id` 和 `x-trace-id`。
- 若上游未提供，服务端自己生成 `requestId`，并默认把 `traceId` 设为同值。
- API 创建任务时继续生成业务 `traceId`，并在返回值、消息和 worker 日志中复用。
- 结构化日志至少记录 `event`、`requestId`、`traceId`、`taskId`、`attemptId`、`status`、`durationMs`。
- API 和 AI Service 的 `/health` 都应返回 `service`、`status`、`uptimeSeconds` 和基础检查信息。

## 日志规范

关键节点必须打结构化日志：

- 任务创建。
- 计费冻结。
- RabbitMQ 消息发布。
- Worker 消费。
- 模型提交。
- 供应商回调。
- 结果下载。
- 媒体处理。
- 资源上传。
- 审核结果。
- 任务成功。
- 任务失败。
- 计费确认或释放。

日志不要记录：

- 用户完整 Token。
- 长期签名 URL。
- 未脱敏手机号、邮箱。
- 供应商密钥。
- 高敏 Prompt 原文。

建议健康检查至少返回：

- `service`
- `status`
- `uptimeSeconds`
- `checks`
- 必要时附带运行模式或依赖状态摘要

## 指标

建议指标：

```txt
任务提交数
任务成功数
任务失败数
任务最终失败数
平均生成耗时
P95 生成耗时
队列积压数量
Worker 消费速度
供应商失败率
供应商超时率
结果上传失败率
审核失败率
计费异常数量
死信队列数量
```

按维度拆分：

```txt
model
provider
taskType
userType
failureCode
stage
```

## 告警

建议告警规则：

- 队列积压超过阈值。
- 死信队列非空或持续增长。
- 某供应商失败率突增。
- 某模型平均耗时突增。
- 结果上传失败率突增。
- 回调失败率突增。
- 计费状态 `adjust_required` 增长。
- Worker 长时间无心跳。

## 运营后台能力

任务查询：

- 按用户、任务 ID、模型、状态、失败原因查询。
- 查看任务详情。
- 查看 attempt 列表。
- 查看供应商任务 ID。
- 查看输入参数摘要。
- 查看资源列表。

任务操作：

- 人工重试。
- 标记最终失败。
- 取消任务。
- 重新投递 RabbitMQ 消息。
- 处理死信任务。
- 人工补发结果。

计费操作：

- 查看计费状态。
- 查看计费流水。
- 释放冻结额度。
- 人工退款。
- 人工补扣。
- 标记账务异常。

资源操作：

- 查看生成结果。
- 查看封面、预览图、源文件。
- 标记资源 blocked。
- 删除资源。
- 重新生成签名 URL。

审核操作：

- 查看审核记录。
- 人工复审。
- 修改审核结论。
- 记录复审原因。

## 死信处理

死信任务后台至少展示：

```txt
queue
routingKey
taskId
attemptId
failureCode
errorMessage
retryCount
createdAt
lastFailedAt
```

支持动作：

```txt
重新投递
标记最终失败
忽略
导出
```

## 最终建议

上线前至少要具备任务查询、attempt 查询、失败原因统计、人工重试、退款补偿和死信处理能力。没有这些能力，AIGC 异步任务生产问题会很难闭环。
