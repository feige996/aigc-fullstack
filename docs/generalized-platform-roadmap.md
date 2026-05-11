# 通用智能项目平台演进路线

## 结论

当前仓库继续服务 AIGC 场景，但从后续迭代开始按“Platform Core + Feature Modules”的方式演进。

推荐方案是方案 C：

```txt
当前仓库继续推进现有功能，同时逐步抽象 platform core，未来复用到小说智选、文档分析或其他智能项目。
```

不建议现在直接把项目改成完全无业务的通用模板。过早抽象会导致代码空泛、验证困难，也会拖慢当前 AIGC 主链路。

## 分层目标

未来系统按两层理解：

```txt
Platform Core
  Auth
  Admin
  Project
  Asset
  Queue
  Task
  Provider
  Workflow
  Observability

Feature Modules
  AIGC 图片/视频生成
  小说智选分析
  文档解析与摘要
  其他智能工作流
```

## 已经比较接近 Platform Core 的模块

以下模块可以继续作为 platform core 的候选模块：

- Auth 用户系统
- Admin 用户管理和权限
- Project 项目边界
- Asset 资产元数据和对象存储
- RabbitMQ 队列基础设施
- AI Service Provider Registry
- Web/Admin monorepo 工程结构

这些模块不应该绑定到“图片生成”“小说分析”或任何具体业务。

## 当前偏 Feature 的模块

以下模块仍偏 AIGC 生成场景，未来应迁移到 feature module：

- `GenerationTask`
- `GenerationTaskAttempt`
- `GenerationTaskStage`
- `BillingStatus`
- `FailureCode` 中部分 provider/媒体处理错误
- `apps/ai-service/src/workers/image_generate_worker.py`
- Web 中的 prompt、ratio、reference assets 任务创建表单
- Admin 中的 Generation Tasks 运营视图

短期不要一次性重命名所有表和类。推荐先通过新增通用概念逐步替换。

## 目标抽象

长期目标是把任务系统抽象为：

```txt
Task
  id
  userId
  projectId
  domain
  type
  model
  status
  stage
  inputPayload
  resultPayload
  failureCode
  createdAt
  updatedAt

TaskAttempt
  id
  taskId
  attemptNo
  provider
  providerTaskId
  status
  stage
  requestPayloadHash
  rawError
```

其中：

- `domain` 区分业务域，例如 `aigc_generation`、`novel_analysis`。
- `type` 区分任务类型，例如 `text_to_image`、`novel_profile_analysis`。
- `inputPayload` 保存业务输入。
- `resultPayload` 保存结构化结果。

## 小说智选示例模块

小说智选不应直接复用 `GenerationTask` 的语义，而应该在通用 Task 之上建业务概念：

```txt
NovelWork
  id
  projectId
  userId
  title
  author
  sourceAssetId
  wordCount
  status

NovelAnalysisResult
  id
  workId
  taskId
  summary
  characters
  relationships
  genres
  tags
  commercialScore
  riskFlags
```

对应任务：

```txt
Task
  domain = novel_analysis
  type = novel_profile_analysis
  inputPayload = {
    workId,
    sourceAssetId,
    analysisOptions
  }
```

## 演进步骤

### 阶段 1：文档和命名边界

- 保留当前 `GenerationTask` 表。
- 文档中明确 `GenerationTask` 是当前 AIGC 业务任务实现。
- 新增通用任务设计文档。
- Provider Registry 继续保持通用，不绑定图片生成。

### 阶段 2：代码中引入通用 Task 语言

- 新增 `TaskDomain`、`TaskType` 约定。
- 给现有 generation task 的 request payload 增加 domain 语义。
- AI Service Worker 逐步从 `image_generate_worker` 迁移到 capability worker。

### 阶段 3：数据库重构

可选路径：

1. 保留 `generation_tasks`，新增 `analysis_tasks`。
2. 新增通用 `tasks` 表，迁移 `generation_tasks`。

推荐先走路径 1，等业务稳定后再考虑统一表。

### 阶段 4：Platform / Feature 目录边界

目录逐步调整为：

```txt
apps/api/src/platform/
  auth
  admin
  projects
  assets
  tasks
  providers
  workflows

apps/api/src/features/
  aigc-generation
  novel-analysis
  document-analysis
```

前端也按类似方式拆分：

```txt
apps/web/src/platform/
apps/web/src/features/
```

## 当前下一步建议

下一步不要直接大规模改表名。建议先做：

1. 新增 platform core 架构边界文档。
2. 新增通用 Task 设计文档。
3. 在 shared contracts 中补 `taskDomain`、`taskType`、`providerCapability` 常量。
4. 把 AI Service provider 文档扩展为 capability 模型。
5. 后续新增业务模块时放入 `features/*`，不要继续扩展 `generation` 命名。
