# Feature Registry 设计

## 目标

Feature Registry 是 platform core 识别业务模块的入口。

当前阶段只建立占位 registry，不做动态插件加载，不改变 Web/Admin/API 运行行为。

## 当前实现

当前默认启用 AIGC 生成业务：

```txt
apps/web/src/features/registry.ts
apps/admin/src/features/registry.ts
apps/api/src/features/feature-registry.ts
```

这三个文件都只注册：

```txt
aigcGenerationFeature
```

原因是当前产品仍以 AIGC 生成链路作为可验证主流程。

## 单业务模式

如果项目只有一个业务，registry 只保留一个 manifest：

```ts
export const webFeatureManifests = [defaultBusinessFeature] as const
```

前端可以直接进入该业务首页，不需要展示业务选择器。

## 多业务模式

如果项目同时接入多个业务，registry 可以注册多个 manifest：

```ts
export const webFeatureManifests = [
  aigcGenerationFeature,
  novelAnalysisFeature,
  documentAnalysisFeature
] as const
```

后续 Web/Admin 可以根据 manifest 生成：

- Project 下的业务入口
- 左侧菜单
- Admin 菜单
- 任务分类
- 权限入口

## 为什么暂不做动态加载

当前不做：

- 从数据库读取 feature。
- 从远程加载 feature。
- feature 独立 npm 包。
- NestJS 动态 module loader。
- Vue 动态路由生成。

原因：

- 现在还没有第二个真实业务模块。
- 过早动态化会增加调试成本。
- 静态 registry 已经足够支持单业务和早期多业务演进。

## 后续接入步骤

当出现第二个业务模块时：

1. 在 `shared-contracts` 中新增或复用对应 manifest。
2. 在 Web/Admin/API registry 中加入该 manifest。
3. Web 根据 manifest 显示业务入口。
4. Admin 根据 manifest 显示运营菜单。
5. API 按 feature module 注册对应 controller/service。

## 边界

Registry 只描述“启用哪些 feature”。

它不负责：

- feature 内部业务逻辑。
- provider 选择。
- task 执行。
- 权限校验细节。
- 数据库迁移。
