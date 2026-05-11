# Platform Core 架构边界

## 目标

本仓库后续不只服务 AIGC，也可能服务小说智选、文档分析、数据处理、企业自动化等项目。

因此系统需要拆成两层：

```txt
platform core
  通用底座，不理解具体业务

feature modules
  业务模块，承载具体产品能力
```

核心原则：

```txt
core 提供能力，feature 表达业务。
```

## Platform Core 包含什么

Platform core 只包含跨业务可复用的能力。

推荐核心模块：

```txt
Auth
  用户注册、登录、token、状态

Admin
  后台入口、用户管理、角色权限

Project
  项目空间、资源归属边界

Asset
  文件上传、对象存储、签名 URL、资产元数据

Task
  异步任务、状态、attempt、失败重试、结果记录

Provider
  外部能力适配，例如 AI、支付、搜索、通知、OCR、文档解析

Workflow
  多步骤任务编排，后续可选

Audit / Log
  操作日志、审计、调试追踪

Notification
  站内通知、短信、邮件、Webhook，后续可选
```

这些模块不应该出现具体业务词汇，例如：

```txt
Prompt
Novel
Character
TextToImage
ComfyUI
商业潜力评分
人物关系
```

## Feature Modules 包含什么

Feature module 负责表达业务语义。

例如 AIGC 生成模块：

```txt
features/aigc-generation
  prompt
  ratio
  generation model
  image/video output
  generation-specific stages
```

例如小说智选模块：

```txt
features/novel-analysis
  novel work
  chapter
  character
  relationship graph
  synopsis
  commercial score
```

例如文档分析模块：

```txt
features/document-analysis
  document parse
  summary
  clause extraction
  risk detection
```

## 推荐目录形态

后端长期目标：

```txt
apps/api/src/platform/
  auth/
  admin/
  projects/
  assets/
  tasks/
  providers/
  workflows/
  audit/

apps/api/src/features/
  aigc-generation/
  novel-analysis/
  document-analysis/
```

前端长期目标：

```txt
apps/web/src/platform/
  auth/
  project/
  asset/
  task/
  layout/

apps/web/src/features/
  aigc-generation/
  novel-analysis/
  document-analysis/
```

AI Service 长期目标：

```txt
apps/ai-service/src/platform/
  providers/
  workers/
  queues/
  callbacks/

apps/ai-service/src/features/
  image-generation/
  text-analysis/
  document-parsing/
```

当前不需要马上搬目录。先从新模块开始按这个边界写，旧模块逐步迁移。

## 通用 Task 设计方向

通用 task 不应该叫 `GenerationTask`，也不应该内置 prompt、ratio、novel、character 等业务字段。

推荐长期字段：

```txt
tasks
  id
  user_id
  project_id
  domain
  type
  status
  stage
  input_payload
  result_payload
  failure_code
  created_at
  updated_at

task_attempts
  id
  task_id
  attempt_no
  provider
  provider_task_id
  status
  request_payload_hash
  raw_error
  started_at
  ended_at
```

业务字段放入 `input_payload` 和 `result_payload`。

示例：

```json
{
  "domain": "document_analysis",
  "type": "document_summary",
  "inputPayload": {
    "assetId": "asset_xxx",
    "language": "zh-CN"
  }
}
```

## Provider 不等于 Adapter

Provider 是系统中的“能力提供方”概念，Adapter 是某个 Provider 的代码适配实现。

因此 core 模块命名保留 `Provider`，不使用 `Provider / Adapter` 这种并列命名。

Provider 不只包括模型供应商。

可以包括：

```txt
AI model provider
OCR provider
document parser
payment provider
SMS provider
email provider
search provider
workflow engine
```

因此后续 provider 应按 capability 分发：

```txt
image_generation
text_analysis
document_parsing
relationship_extraction
payment
notification
search
```

## 当前仓库的过渡状态

当前已经具备一部分 core：

- Auth
- Admin
- Project
- Asset
- RabbitMQ
- Provider Registry

当前仍偏 feature：

- `GenerationTask`
- `GenerationTaskAttempt`
- `image_generate_worker`
- Web 的 prompt/ratio 表单
- Admin 的 Generation Tasks 页面

短期允许这些继续存在。下一步的重点不是删除它们，而是避免新能力继续绑定到 AIGC 命名。

## 迁移原则

1. 不做一次性大重构。
2. 不破坏现有浏览器验证链路。
3. 新模块优先放在 platform/feature 边界下。
4. 旧模块稳定后再迁移命名和目录。
5. 数据库表名迁移最后做，避免早期 churn。

## 推荐下一步

下一步适合做：

1. 在 `shared-contracts` 中加入通用 `taskDomains`、`taskTypes`、`providerCapabilities`。
2. 新增 `docs/task-contracts.md` 描述通用 task 契约。
3. 暂不修改现有 generation 消息，等出现第二个业务模块后再落运行时字段。
4. 未来新增业务时，放在 `features/*`，不要继续扩展 `generation` 命名。
