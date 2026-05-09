# AIGC 幂等与 Attempt 执行模型

## 目标

AIGC 任务链路会经历网络重试、RabbitMQ 重投递、供应商重复回调、用户手动重试和人工补偿。必须通过幂等设计避免重复扣费、重复入库、状态回滚和重复展示作品。

核心原则：

- `taskId` 表示业务任务。
- `attemptId` 表示一次执行轮次。
- 所有跨服务请求必须带 `idempotencyKey`。
- NestJS 是任务最终状态源。
- 回调和消息消费必须允许重复到达。

## 数据模型

建议拆成两张核心表：

```txt
generation_task
generation_task_attempt
```

### generation_task

业务任务主表，面向前端和业务系统。

核心字段：

```txt
id
userId
projectId
type
model
status
stage
failureCode
billingStatus
currentAttemptId
maxAttempts
createdAt
updatedAt
completedAt
```

### generation_task_attempt

执行轮次表，记录每次尝试。

核心字段：

```txt
id
taskId
attempt
status
stage
failureCode
retryable
provider
providerTaskId
idempotencyKey
requestPayloadHash
startedAt
endedAt
errorMessage
rawError
```

示例：

```txt
task_001
  attempt_001 failed PROVIDER_TIMEOUT
  attempt_002 failed ASSET_UPLOAD_FAILED
  attempt_003 succeeded
```

## 幂等键设计

推荐幂等键：

```txt
create task：userId + requestHash + clientRequestId
publish queue：taskId + attemptId + queue.publish
worker consume：taskId + attemptId + worker.consume
provider submit：taskId + attemptId + provider.submit
callback handle：provider + providerTaskId + callbackEventId
asset persist：taskId + attemptId + asset.persist
billing confirm：taskId + billing.confirm
```

## 幂等处理规则

### 提交任务

前端提交任务时建议带 `clientRequestId`：

```json
{
  "clientRequestId": "uuid-from-client",
  "model": "video_v1",
  "prompt": "..."
}
```

NestJS 根据 `userId + clientRequestId` 防止用户重复点击导致多任务。

### RabbitMQ 消费

Worker 消费消息时：

- 先读取 `taskId` 和 `attemptId`。
- 向 NestJS 或本地记录确认 attempt 是否仍有效。
- 如果任务已取消、已成功、已最终失败，应直接 ack 并停止执行。
- 如果 attempt 已处理成功，应直接 ack。

### 供应商回调

供应商可能重复回调。NestJS 处理回调时必须：

- 根据 `providerTaskId` 或 `callbackEventId` 去重。
- 禁止从终态回滚到非终态。
- 禁止重复创建作品资产。
- 禁止重复确认扣费。

### 状态更新

状态更新必须遵守单向流转：

```txt
非终态 -> 终态：允许
终态 -> 非终态：禁止
succeeded -> failed：禁止
final_failed -> succeeded：默认禁止，人工补偿除外
```

人工补偿必须单独记录审计日志。

## 重试模型

自动重试时创建新的 attempt：

```txt
attempt_1 failed
attempt_2 retrying/running
```

不要覆盖旧 attempt 的错误信息。

推荐流程：

```txt
1. attempt_1 执行失败。
2. NestJS 判断 failureCode 是否可重试。
3. 若可重试且未达上限，创建 attempt_2。
4. 发布新的 RabbitMQ 消息。
5. currentAttemptId 指向 attempt_2。
```

## 请求哈希

建议保存 `requestPayloadHash`，用于排查和幂等判断。

哈希内容应包含：

```txt
模型
Prompt
参数
参考图 cosPath
尺寸
时长
风格
```

不建议直接把完整敏感 Prompt 用作幂等键。

## 最终建议

业务任务和执行轮次必须分离。`generation_task` 面向用户和业务状态，`generation_task_attempt` 面向执行、排障、重试和供应商质量分析。
