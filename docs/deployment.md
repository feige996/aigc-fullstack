# 部署说明

本仓库的部署模板围绕 4 个应用服务展开：

- `web`：用户端静态站点
- `admin`：运营后台静态站点
- `api`：NestJS 主业务 API
- `ai-service`：FastAPI HTTP 服务和 worker

## Docker 镜像约定

每个应用目录下都提供自己的 Dockerfile：

- [apps/web/Dockerfile](../apps/web/Dockerfile)
- [apps/admin/Dockerfile](../apps/admin/Dockerfile)
- [apps/api/Dockerfile](../apps/api/Dockerfile)
- [apps/ai-service/Dockerfile](../apps/ai-service/Dockerfile)

对应的 `.dockerignore` 只排除本地依赖、构建产物和临时文件，避免把无关内容送进构建上下文。

上线前可以用统一脚本验证镜像是否仍可从仓库根目录构建：

```bash
pnpm verify:docker-builds -- --dry-run
pnpm verify:docker-builds
```

只验证单个镜像：

```bash
pnpm verify:docker-builds -- --service api
```

## 健康检查约定

容器级健康检查统一走 `/health`：

- `web` 和 `admin`：`GET /health`
- `api`：`GET /api/health`
- `ai-service` HTTP：`GET /health`

`worker` 没有 HTTP 监听端口，不做容器健康检查。

建议在 compose、Kubernetes 或负载均衡器里直接复用这些路径。

## 反向代理

生产环境建议让用户端和运营后台使用不同域名：

- `app.example.com` -> `web:80`
- `admin.example.com` -> `admin:80`
- 两个域名的 `/api/` 都转发到 `api:3000`

示例配置见 [infra/nginx/aigc.conf](../infra/nginx/aigc.conf)。

不建议直接把后台挂在 `/admin/` 子路径下，除非同时调整后台 Vite `base`、静态资源路径和路由历史模式。当前模板默认按根路径构建，分域名部署最稳。

## Compose 示例

预生产模板：

- [infra/compose/docker-compose.preprod.yml](../infra/compose/docker-compose.preprod.yml)

生产模板：

- [infra/compose/docker-compose.prod.yml](../infra/compose/docker-compose.prod.yml)

这两份示例都假设从仓库根目录构建，并通过 app 目录下的 Dockerfile 生成镜像。

常见启动方式：

```bash
docker compose -f infra/compose/docker-compose.preprod.yml up -d --build
```

生产环境通常会把 `build:` 替换成镜像仓库地址，并保留同样的端口、环境变量和健康检查约定。

## 数据库迁移

本地开发使用：

```bash
pnpm --filter @aigc/api prisma:migrate
```

生产环境不要使用 `prisma migrate dev`。推荐上线顺序：

1. 备份生产数据库。
2. 使用同一版本镜像或同一份代码执行 `prisma migrate deploy`。
3. 执行 `prisma migrate status` 确认迁移状态。
4. 再滚动发布 `api`、`worker`、`web` 和 `admin`。
5. 发布后检查 `/api/health`、队列 consumer、对象存储访问和核心业务烟测。

迁移脚本目录说明见 [scripts/migrate/README.md](../scripts/migrate/README.md)。

## 环境变量

部署时至少要提供：

```txt
DATABASE_URL
RABBITMQ_URL
JWT_ACCESS_SECRET
SSE_TICKET_SECRET
OBJECT_STORAGE_ENDPOINT
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY
OBJECT_STORAGE_SECURE
API_BASE_URL
```

如果使用外部 MySQL、RabbitMQ、MinIO 或对象存储服务，把 compose 里的默认值覆盖掉即可。

生产环境必须覆盖所有示例密钥和默认密码，尤其是 `JWT_ACCESS_SECRET`、`SSE_TICKET_SECRET`、数据库密码、RabbitMQ 密码和对象存储密钥。API 在生产模式下会拒绝明显的弱密钥。

## 发布前检查清单

建议每次发布至少执行：

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm verify:docker-builds
docker compose -f infra/compose/docker-compose.prod.yml config
```

涉及生成链路、队列、对象存储或认证改动时，再补充：

```bash
pnpm smoke:generation
```
