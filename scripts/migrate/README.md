# Migration Scripts

数据库结构迁移由 `apps/api/prisma` 管理。本目录保留给一次性数据修复、历史数据回填和上线迁移说明。

## 本地开发

本地开发可以直接运行：

```bash
pnpm --filter @aigc/api prisma:migrate
```

该命令会使用 Prisma `migrate dev`，适合开发库，不适合生产库。

## 生产发布

生产环境推荐流程：

1. 确认当前代码已经通过 `pnpm typecheck`、`pnpm test` 和 `pnpm build`。
2. 备份生产数据库，并记录当前镜像版本和 Git commit。
3. 使用发布镜像或同一份代码运行 `prisma migrate deploy`。
4. 运行 `prisma migrate status` 确认没有 pending 或 failed migration。
5. 迁移完成后再滚动发布 API、worker 和前端。
6. 发布后检查 `/api/health`、队列 consumer、对象存储读写和业务烟测。

示例：

```bash
DATABASE_URL='mysql://user:password@host:3306/aigc' pnpm --filter @aigc/api exec prisma migrate deploy
DATABASE_URL='mysql://user:password@host:3306/aigc' pnpm --filter @aigc/api exec prisma migrate status
```

不要在生产环境运行 `prisma migrate dev` 或 `prisma migrate reset`。

## 一次性数据脚本

如果后续需要数据回填脚本，建议按以下约定放置：

```txt
scripts/migrate/YYYYMMDD-short-description.ts
```

脚本应满足：

- 默认 dry-run，明确传入执行参数后才写入。
- 打印受影响记录数和关键过滤条件。
- 可重复执行，或在脚本开头说明为什么不能重复执行。
- 在 PR 中附上执行命令、回滚方案和验证结果。
