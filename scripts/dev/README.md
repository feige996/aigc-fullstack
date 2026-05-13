# 开发脚本

本目录存放本地开发、烟测和诊断脚本。完整本地开发流程见
[`docs/local-development.md`](../../docs/local-development.md)。

## smoke-generation.mjs

运行命令：

```bash
pnpm smoke:generation
```

用途：

- 登录本地 API。
- 创建一个 mock 文生图任务。
- 轮询任务直到进入终态。
- 校验任务成功、存在输出资产，并下载第一个输出文件。

前置条件：

- 已启动基础设施：`docker compose -f infra/compose/docker-compose.yml up -d`
- 已启动 API 和 AI worker：推荐使用 `pnpm dev` 或 `pnpm dev:generation`
- 已有可登录测试账号，默认使用 seed 账号

常用环境变量：

```txt
API_BASE_URL=http://localhost:3000/api
SMOKE_PHONE_NUMBER=13900139000
SMOKE_PASSWORD=password123
SMOKE_PROMPT=smoke test product photo
SMOKE_TIMEOUT_MS=30000
SMOKE_INTERVAL_MS=1000
```

## doctor.mjs

运行命令：

```bash
pnpm doctor
```

用途：

- 检查本地基础命令是否可用。
- 检查 `.env` 是否存在。
- 检查 Docker 基础设施容器是否运行。
- 检查 API、MinIO 和 RabbitMQ 队列 consumer 状态。

## setup.mjs

运行命令：

```bash
pnpm setup
```

用途：

- 检查首次本地开发初始化状态。
- 如果 `.env` 不存在，从 `.env.example` 创建。
- 检查 `node_modules` 和 `apps/ai-service/.venv` 是否存在。
- 提示下一步需要运行的 Docker、dev 和 doctor 命令。

`setup.mjs` 不会覆盖已有 `.env`，不会自动安装依赖，也不会自动启动 Docker 容器。

## 后续脚本预留

后续可以在本目录增加更多诊断脚本，例如端口占用检查或数据库迁移状态检查。
