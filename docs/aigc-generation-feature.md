# AIGC Generation Feature

## 目标

本文档标记当前 AIGC 生成能力的 feature 边界。

当前代码仍处于过渡状态：AIGC 生成链路已经通过 `aigcGenerationFeature` 在 feature registry 中声明，但实际代码还没有迁移到 `features/aigc-generation` 目录。

这是有意的渐进迁移，目的是不破坏当前浏览器验证链路。

## Feature Manifest

当前 manifest 定义在：

```txt
packages/shared-contracts/src/features.ts
```

对应导出：

```ts
aigcGenerationFeature
```

当前 registry 已静态启用该 feature：

```txt
apps/web/src/features/registry.ts
apps/admin/src/features/registry.ts
apps/api/src/features/feature-registry.ts
```

## 当前代码归属

以下代码属于 AIGC Generation feature。

### API

```txt
apps/api/src/generation/
```

当前包含：

- 生成任务创建
- 任务列表和详情
- 任务取消和重试
- RabbitMQ 任务发布
- RabbitMQ 结果消费
- SSE 任务事件推送

### Web

当前用户端 AIGC UI 仍在：

```txt
apps/web/src/App.vue
```

其中以下部分属于 AIGC feature：

- prompt 输入
- ratio 选择
- reference assets 选择
- Submit Task
- Current Task
- Recent Tasks
- SSE 任务状态展示

以下部分更偏 platform：

- 登录
- 修改密码
- Project 创建和选择
- Asset 上传

### Admin

当前后台 AIGC UI 仍在：

```txt
apps/admin/src/App.vue
```

其中以下部分属于 AIGC feature：

- Generation Tasks 菜单
- 任务列表
- 任务详情
- retry / cancel 操作
- attempt 展示

以下部分更偏 platform：

- 登录
- 用户管理
- 项目列表
- 账号修改密码

### AI Service

当前 AIGC Worker：

```txt
apps/ai-service/src/workers/image_generate_worker.py
```

当前 provider 抽象：

```txt
apps/ai-service/src/providers/
```

其中 provider registry 是 platform 候选能力，`image_generate_worker.py` 是 AIGC feature 候选实现。

## 迁移目标目录

长期目标：

```txt
apps/api/src/features/aigc-generation/
  generation.controller.ts
  generation.service.ts
  generation-events.service.ts
  generation-publisher.service.ts
  generation-result-consumer.service.ts
  dto/
  feature.manifest.ts
```

```txt
apps/web/src/features/aigc-generation/
  GenerationWorkspace.vue
  task-api.ts
  feature.manifest.ts
```

```txt
apps/admin/src/features/aigc-generation/
  AdminGenerationTasks.vue
  generation-admin-api.ts
  feature.manifest.ts
```

```txt
apps/ai-service/src/features/image-generation/
  worker.py
```

## 迁移 Checklist

迁移前提：

- 当前浏览器验证链路稳定。
- 新业务模块已经开始开发，确实需要 feature 目录边界。
- 不在同一次提交里做大规模命名和行为修改。

建议迁移顺序：

1. Web 拆 `GenerationWorkspace.vue`，不改 UI 行为。
2. Admin 拆 `AdminGenerationTasks.vue`，不改 UI 行为。
3. API 把 `generation` 目录移动到 `features/aigc-generation`，保持路由不变。
4. AI Service 把 `image_generate_worker.py` 移动到 `features/image-generation/worker.py`，保持启动入口不变。
5. 每一步后都运行浏览器验证。

## 验证项

每次迁移后至少验证：

- Web 可以登录。
- Web 可以创建或选择 Project。
- Web 可以上传 Asset。
- Web 可以提交生成任务。
- Web 可以收到 SSE 更新。
- Admin 可以查看任务。
- Admin 可以 retry / cancel。
- AI Service mock worker 可以消费任务并回写结果。

## 当前不做

当前不做：

- 不移动目录。
- 不重命名 `GenerationTask` 数据库表。
- 不新增通用 `tasks` 表。
- 不生成动态路由。
- 不改变 API 路径。
