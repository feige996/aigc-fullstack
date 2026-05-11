# Feature Manifest 设计

## 目标

Feature Manifest 用来描述一个业务模块如何被平台识别。

它解决的问题：

- 单业务项目可以只注册一个 feature。
- 多业务项目可以注册多个 feature。
- Platform Core 不需要理解具体业务细节。
- Web/Admin 可以根据 manifest 生成入口、菜单和任务分类。

当前阶段只定义契约，不做运行时插件加载。

## Manifest 字段

```ts
interface FeatureManifest {
  domain: TaskDomain
  name: string
  description?: string
  taskTypes: TaskType[]
  providerCapabilities: ProviderCapability[]
  webRoutes?: FeatureRoute[]
  adminMenus?: FeatureAdminMenu[]
}
```

字段说明：

| 字段 | 含义 |
| --- | --- |
| `domain` | 业务域，例如 `aigc_generation`、`novel_analysis` |
| `name` | 展示名称 |
| `description` | 业务模块说明 |
| `taskTypes` | 该业务模块声明的任务类型 |
| `providerCapabilities` | 该业务模块需要的平台能力 |
| `webRoutes` | 用户端入口约定 |
| `adminMenus` | 管理后台入口约定 |

## 单业务项目

如果未来项目只有一个业务，可以只注册一个 feature。

示例：

```ts
export const defaultFeature = {
  domain: 'default',
  name: '默认业务',
  taskTypes: ['generic_task'],
  providerCapabilities: ['generic_execution'],
  webRoutes: [
    {
      path: '/workspace',
      label: '工作台',
      entry: 'features/default-business/WorkspaceView'
    }
  ],
  adminMenus: [
    {
      path: '/admin/tasks',
      label: '任务管理',
      entry: 'features/default-business/AdminTasksView',
      requiredRoles: ['admin', 'super_admin']
    }
  ]
} satisfies FeatureManifest
```

此时用户不会感知“多业务平台”，系统表现就是一个普通业务系统。

## 多业务项目

如果未来同时接入多个业务，可以注册多个 feature。

示例：AIGC 生成

```ts
export const aigcGenerationFeature = {
  domain: 'aigc_generation',
  name: 'AIGC 生成',
  taskTypes: ['text_to_image', 'image_to_image', 'video_generation'],
  providerCapabilities: ['image_generation', 'video_generation', 'image_processing'],
  webRoutes: [
    {
      path: '/projects/:projectId/generation',
      label: '生成工作台',
      entry: 'features/aigc-generation/GenerationWorkspace'
    }
  ],
  adminMenus: [
    {
      path: '/admin/generation/tasks',
      label: '生成任务',
      entry: 'features/aigc-generation/AdminGenerationTasks',
      requiredRoles: ['admin', 'super_admin']
    }
  ]
} satisfies FeatureManifest
```

示例：小说分析

```ts
export const novelAnalysisFeature = {
  domain: 'novel_analysis',
  name: '小说智选',
  taskTypes: ['novel_profile_analysis'],
  providerCapabilities: ['document_parsing', 'text_analysis', 'relationship_extraction'],
  webRoutes: [
    {
      path: '/projects/:projectId/novels',
      label: '小说分析',
      entry: 'features/novel-analysis/NovelWorkspace'
    }
  ],
  adminMenus: [
    {
      path: '/admin/novels',
      label: '小说项目',
      entry: 'features/novel-analysis/AdminNovelProjects',
      requiredRoles: ['admin', 'super_admin']
    }
  ]
} satisfies FeatureManifest
```

## 不做什么

当前阶段不做：

- 不做动态插件加载。
- 不做远程安装 feature。
- 不做独立 npm 包 feature。
- 不做数据库中的 feature registry。
- 不改变现有 Web/Admin 路由。

当前阶段只做：

- 在 `shared-contracts` 中定义 `FeatureManifest` 类型。
- 在文档中明确单业务和多业务的设计方式。
- 在 `shared-contracts` 中提供示例 manifest，作为后续实现参考。

示例位置：

```txt
packages/shared-contracts/src/features.ts
```

## 后续落地时机

当出现以下情况时，再把 manifest 接入运行时：

- Web 需要根据 feature 自动生成导航。
- Admin 需要根据 feature 自动生成菜单。
- 一个 Project 下需要展示多个业务入口。
- 第二个真实业务模块开始开发。

## 推荐目录

未来代码可以逐步演进为：

```txt
apps/web/src/features/
  aigc-generation/
    feature.manifest.ts
    GenerationWorkspace.vue

  novel-analysis/
    feature.manifest.ts
    NovelWorkspace.vue
```

```txt
apps/api/src/features/
  aigc-generation/
    feature.manifest.ts
    generation.controller.ts

  novel-analysis/
    feature.manifest.ts
    novel.controller.ts
```
