# 仓库指南

## 项目结构

这是一个 pnpm + Turborepo monorepo。主要代码在 `apps/`：

- `apps/web`：用户端 Vue 应用
- `apps/admin`：运营后台 Vue 应用
- `apps/api`：NestJS API，使用 Prisma 和 MySQL
- `apps/ai-service`：FastAPI Worker / 服务

共享代码在 `packages/`：

- `packages/shared-contracts`：事件名、队列名、API 契约
- `packages/shared-config`：共享 TypeScript 配置
- `packages/shared-utils`：纯工具函数

基础设施和设计文档在 `infra/`、`docs/`、`scripts/`。

## 构建、测试和开发

- `pnpm install`：安装工作区依赖
- `cd apps/ai-service && uv sync`：安装 Python 依赖
- `docker compose -f infra/compose/docker-compose.yml up -d`：启动 MySQL、Redis、RabbitMQ、MinIO
- `pnpm dev`：启动所有 Node 工作区开发任务
- `pnpm --filter @aigc/api dev`：只启动 API
- `pnpm build`：构建所有包和应用
- `pnpm lint`：运行工作区 lint
- `pnpm test`：运行工作区测试
- `pnpm typecheck`：运行 TypeScript 类型检查
- `pnpm smoke:generation`：运行生成链路烟测

## 代码风格与命名

沿用仓库现有风格：TypeScript/Vue，使用 Prettier 格式化，保持 ASCII 文本，命名尽量短且明确。导入按既有方式分组，共享契约优先显式类型。变量/函数用 `camelCase`，类型/组件用 `PascalCase`，只有运行时契约要求时才用 `snake_case`。改动较多时先运行 `pnpm format`。

## 测试指引

先做定点验证：`pnpm --filter <package> typecheck`，再跑 `pnpm build`，涉及工作流时再跑 `pnpm smoke:generation`。测试应放在对应功能或包附近，命名要能直接反映行为。

## 提交与 PR

提交信息使用常见前缀：`feat:`、`fix:`、`docs:`、`chore:`、`refactor:`。标题保持简短、祈使句式，例如 `refactor: generalize generation tasks to platform tasks`。

PR 需要包含：变更摘要、执行过的命令、UI 或烟测变更时的截图/日志。

## 配置与安全

本地先复制 `.env.example`，不要提交密钥。Docker Compose 默认账号来自 `infra/compose/docker-compose.yml`。涉及 Prisma 的改动，合并前先验证 schema。

## Agent 约定

- 默认使用中文回复用户。
