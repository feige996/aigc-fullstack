# E2E Testing

当前模板已经提供 API 单元测试、共享契约测试、前端类型检查和生成链路烟测。端到端测试建议按风险逐步补齐，不需要一开始覆盖所有页面。

## 推荐覆盖顺序

第一阶段覆盖最小可用链路：

- 用户登录。
- 创建项目。
- 上传素材。
- 发起生成任务。
- 等待任务进入终态。
- 查看输出资产。

第二阶段覆盖运营后台：

- 管理员登录。
- 查看用户列表。
- 更新用户状态或角色。
- 确认普通用户不能访问后台接口。

第三阶段覆盖异常路径：

- 登录过期后的 refresh。
- 队列任务失败后的错误展示。
- 对象存储上传失败后的重试提示。

## 当前可执行烟测

生成链路已有脚本：

```bash
pnpm smoke:generation
```

它会通过真实 API 创建任务、等待 worker 处理并验证输出资产，适合作为 CI 或预生产发布后的核心业务烟测。

## 后续 Playwright 落地建议

如果项目需要浏览器级 E2E，建议新增 Playwright，并把测试放在 `apps/e2e` 或 `tests/e2e`：

```txt
tests/e2e/
  auth.spec.ts
  generation.spec.ts
  admin-users.spec.ts
```

建议先只接入 Chromium，等核心链路稳定后再扩展 Firefox 和 WebKit。CI 中应复用 compose 环境，并在测试前执行数据库迁移和 seed。
