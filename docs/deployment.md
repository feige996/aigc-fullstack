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

## 健康检查约定

容器级健康检查统一走 `/health`：

- `web` 和 `admin`：`GET /health`
- `api`：`GET /api/health`
- `ai-service` HTTP：`GET /health`

`worker` 没有 HTTP 监听端口，不做容器健康检查。

建议在 compose、Kubernetes 或负载均衡器里直接复用这些路径。

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
