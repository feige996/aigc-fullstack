# AIGC 任务与计费一致性设计

## 目标

AIGC 任务通常是异步执行，链路包含提交、排队、模型执行、结果上传、审核、回调、入库、扣费。计费设计必须能处理重复回调、任务失败、用户取消、审核失败和人工补偿。

核心原则：

- NestJS 是计费状态源。
- 计费状态和任务状态分开维护。
- 扣费必须幂等。
- 优先使用冻结、确认扣费、释放冻结三阶段。
- 所有人工调整必须有审计日志。

## 计费状态

推荐字段：

```ts
type BillingStatus =
  | 'none'
  | 'freezing'
  | 'frozen'
  | 'freeze_failed'
  | 'confirming'
  | 'confirmed'
  | 'releasing'
  | 'released'
  | 'refunding'
  | 'refunded'
  | 'adjust_required'
```

状态说明：

| 状态 | 含义 |
| --- | --- |
| `none` | 不需要计费或尚未进入计费流程 |
| `freezing` | 正在冻结额度 |
| `frozen` | 额度已冻结，任务可入队 |
| `freeze_failed` | 冻结失败，任务不能继续 |
| `confirming` | 正在确认扣费 |
| `confirmed` | 已扣费 |
| `releasing` | 正在释放冻结额度 |
| `released` | 已释放冻结额度 |
| `refunding` | 正在退款 |
| `refunded` | 已退款 |
| `adjust_required` | 状态异常，需要人工处理 |

## 推荐计费链路

正常成功：

```txt
none -> freezing -> frozen -> confirming -> confirmed
```

提交前审核失败：

```txt
none -> released
```

已冻结后失败：

```txt
frozen -> releasing -> released
```

已扣费后需要补偿：

```txt
confirmed -> refunding -> refunded
```

异常需要人工处理：

```txt
freezing -> adjust_required
confirming -> adjust_required
releasing -> adjust_required
refunding -> adjust_required
```

## 不同任务结果的计费策略

| 场景 | 任务状态 | 计费建议 |
| --- | --- | --- |
| 参数非法 | `rejected` | 不冻结、不扣费 |
| Prompt 敏感词 | `rejected` | 不冻结、不扣费 |
| 上传素材审核失败 | `rejected` | 不冻结、不扣费 |
| 队列投递失败 | `failed` / `final_failed` | 释放冻结额度 |
| 供应商超时 | `failed` / `final_failed` | 自动重试，最终失败释放 |
| 供应商返回失败 | `failed` / `final_failed` | 按是否产生成本决定，默认释放 |
| 结果审核失败 | `final_failed` | 建议默认不扣费或走特殊成本策略 |
| 结果上传失败 | `failed` | 可重试，最终失败释放 |
| 成功入库 | `succeeded` | 确认扣费 |
| 用户取消 | `canceled` | 未执行释放，已执行按业务策略 |

## 幂等要求

以下动作必须幂等：

- 冻结额度。
- 确认扣费。
- 释放冻结额度。
- 退款。
- 人工补扣或补退。

建议幂等键：

```txt
freeze：taskId + billing.freeze
confirm：taskId + billing.confirm
release：taskId + billing.release
refund：taskId + billing.refund
manual_adjust：adjustmentId
```

## 账务记录

不要只在任务表里记录余额变化。建议有独立流水表：

```txt
billing_transaction
```

核心字段：

```txt
id
userId
taskId
attemptId
type：freeze | confirm | release | refund | manual_adjust
amount
currency：credits | money
status
idempotencyKey
reason
operatorId
createdAt
updatedAt
```

## 人工补偿

运营后台至少需要支持：

- 查看任务计费状态。
- 查看计费流水。
- 释放冻结额度。
- 人工退款。
- 人工补扣。
- 标记为需要财务处理。

所有人工操作必须记录：

```txt
operatorId
operation
before
after
reason
createdAt
```

## 最终建议

任务状态和计费状态分开维护。任务是否成功不应直接等同于是否扣费，最终扣费必须以 NestJS 的幂等账务流水为准。
