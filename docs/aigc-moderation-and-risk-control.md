# AIGC 审核与风控策略

## 目标

AIGC 项目需要同时审核用户输入、用户上传素材和生成结果。审核策略必须影响任务状态、计费策略、资源可见性和用户风控。

核心原则：

- 输入审核前置，尽量避免无效模型调用。
- 结果审核后置，避免违规内容展示。
- 审核失败不使用普通 `failed`，应映射为 `rejected` 或 `final_failed`。
- 审核结果要结构化，不能只保存一段错误文案。

## 审核对象

推荐覆盖：

```txt
Prompt
Negative Prompt
用户上传图片
用户上传视频
用户上传音频
参考图
参考视频
模型生成图片
模型生成视频
封面图
字幕与文本结果
```

## 审核阶段

输入文本审核：

```txt
stage = text_moderation
failureCode = PROMPT_SENSITIVE | TEXT_MODERATION_REJECTED
```

输入素材审核：

```txt
stage = asset_moderation
failureCode = ASSET_MODERATION_REJECTED
```

生成结果审核：

```txt
stage = result_moderation
failureCode = RESULT_MODERATION_REJECTED
```

## 状态映射

提交前审核失败：

```txt
validating -> rejected
```

含义：

- 不进入模型执行。
- 不应扣费。
- 前端提示用户修改输入。

生成后审核失败：

```txt
running -> final_failed
```

含义：

- 模型已执行。
- 结果资源标记为 `blocked`。
- 不向用户展示原始结果。
- 是否扣费按业务策略决定。

## 审核结果字段

建议保存：

```txt
moderationStatus：pending | passed | rejected | manual_review
moderationStage：text | asset | result
moderationProvider
moderationLabels
moderationScore
moderationReason
moderationTraceId
reviewerId
reviewedAt
```

示例标签：

```txt
sexual
violence
political
illegal
copyright
minor
celebrity
personal_info
```

## 人工复审

高风险或模型不确定时建议进入人工复审：

```txt
moderationStatus = manual_review
```

人工复审结果：

```txt
manual_review -> passed
manual_review -> rejected
```

需要记录：

```txt
reviewerId
decision
reason
before
after
createdAt
```

## 风控策略

建议记录用户风险信号：

- 敏感词命中次数。
- 审核失败次数。
- 生成结果违规次数。
- 短时间高频提交。
- 多次尝试绕过审核。

可选动作：

```txt
正常放行
增加人工复审
限制生成频率
禁用高风险模型
冻结账号
提交运营处理
```

## 前端展示

不要向用户展示底层审核标签和供应商原始错误。

推荐文案类型：

```txt
内容不符合平台规范，请修改后重试
上传素材未通过审核，请更换素材
生成结果未通过审核，本次任务未完成
```

## 最终建议

审核系统应作为任务状态机的一部分，而不是简单的接口校验。输入审核失败走 `rejected`，结果审核失败走 `final_failed`，资源状态同步标记为 `blocked`。
