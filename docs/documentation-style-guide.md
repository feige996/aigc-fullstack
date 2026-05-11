# 文档写作约定

## 目标

本文档用于统一 README 和 `docs/` 目录下的文档写法，降低国内团队成员阅读成本，同时保留必要的英文技术名词，方便搜索资料、阅读源码和对接外部系统。

## 总体规则

推荐约定：

- 文件名使用英文 kebab-case。
- 文档标题和正文使用中文。
- 技术专有名词保留英文原词。
- 关键术语首次出现时使用中文 + 英文对照。
- 后续同一文档中，业务语境优先使用中文，工程配置和代码字段保持英文。

示例：

```txt
文件名：aigc-ai-service-monorepo-decision.md
标题：# AIGC AI 服务与 Monorepo 边界决策
正文：AI 服务必须保持独立运行和独立部署。
```

## 文件命名

文档文件名继续使用英文 kebab-case。

推荐：

```txt
docs/aigc-monorepo-architecture.md
docs/aigc-ai-service-monorepo-decision.md
docs/aigc-queue-rabbitmq-vs-bullmq.md
docs/auth-account-model.md
```

不推荐：

```txt
docs/AIGC Monorepo 架构.md
docs/AI服务与单仓库边界决策.md
docs/队列选型.md
```

原因：

- Git、终端、CI、Docker 和不同操作系统中更稳定。
- Markdown 链接和 URL 更少出现编码问题。
- 方便脚本、自动化文档生成和全文搜索。
- 英文技术关键词更容易和源码、配置、外部文档对应。

## 标题和正文

文档标题和正文使用中文。

推荐：

```md
# AIGC 队列选型：RabbitMQ 与 BullMQ

当前 AIGC 项目直接使用 RabbitMQ。
```

不推荐：

```md
# AIGC Queue Selection

This document explains why RabbitMQ is selected.
```

如果某个英文产品名、协议名、库名或命令本身没有合适中文表达，直接保留英文。

例如：

```txt
NestJS
FastAPI
RabbitMQ
BullMQ
Redis
Prisma
SSE
JWT
CI/CD
Worker
Docker Compose
```

## 术语中英对照

关键术语首次出现时，使用中文 + 英文对照。

推荐格式：

```md
主业务状态源（Source of Truth）
幂等键（Idempotency Key）
死信队列（Dead Letter Queue, DLQ）
路由键（Routing Key）
对象存储（Object Storage）
```

后续写法：

- 面向业务、产品、运营的概念，后文优先使用中文。
- 面向配置、代码、协议的概念，后文优先保留英文。
- 容易混淆的架构概念，可以在同一文档中持续保留中英对照。

示例：

```md
任务状态机（Task State Machine）由 NestJS API 维护。

后续任务状态变更必须经过任务状态机，不能由 Worker 直接修改最终状态。
```

## 常用术语表

| 中文 | 英文 | 备注 |
| --- | --- | --- |
| 单仓库 | Monorepo | 本项目保留 `monorepo` 英文写法也可以 |
| 主业务状态源 | Source of Truth | 指最终可信业务状态所在服务或数据库 |
| 异步任务队列 | Async Job Queue | 长耗时任务通过队列解耦 |
| 消息队列 | Message Queue | RabbitMQ 属于消息队列 |
| 交换机 | Exchange | RabbitMQ 概念 |
| 路由键 | Routing Key | RabbitMQ 概念 |
| 死信队列 | Dead Letter Queue, DLQ | 失败或不可消费消息的隔离队列 |
| 消费者 | Consumer | 消费队列消息的服务或进程 |
| 生产者 | Producer | 发布消息的服务或进程 |
| 工作进程 | Worker | 执行异步任务的进程 |
| 幂等 | Idempotency | 重复执行不会造成重复副作用 |
| 幂等键 | Idempotency Key | 用于识别同一业务操作 |
| 执行轮次 | Attempt | 一次任务执行尝试 |
| 对象存储 | Object Storage | COS/OSS/S3/MinIO |
| 签名 URL | Signed URL | 临时授权访问资源 |
| 实时推送 | Realtime Push | SSE 或 WebSocket |
| 服务边界 | Service Boundary | 服务之间的职责和运行边界 |
| 故障域 | Failure Domain | 故障影响范围 |
| 可观测性 | Observability | 日志、指标、链路追踪等 |

## 代码和配置

代码字段、环境变量、命令、路径和配置值保持原样，不翻译。

推荐：

````md
任务消息中的 `traceId`、`taskId`、`attemptId` 必须保持稳定。

本地 RabbitMQ 地址由 `RABBITMQ_URL` 配置。

运行命令：

```bash
pnpm --filter @aigc/api dev
```
````

不推荐：

```md
任务消息中的 `追踪编号`、`任务编号`、`执行轮次编号` 必须保持稳定。
```

## 链接标题

README 或索引文档中的链接标题使用中文。

推荐：

```md
- [AI 服务与 Monorepo 边界决策](./docs/aigc-ai-service-monorepo-decision.md)
- [队列选型：RabbitMQ 与 BullMQ](./docs/aigc-queue-rabbitmq-vs-bullmq.md)
```

文件路径仍然保持英文。

## 修改文档时的检查项

新增或修改文档时，检查：

- 文件名是否是英文 kebab-case。
- 标题和正文是否以中文为主。
- 关键术语首次出现是否有中英对照。
- 代码字段、命令、环境变量和路径是否保持原样。
- README 或相关索引是否需要补充链接。
- 是否避免中英文在同一概念上反复切换。
