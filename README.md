# AIGC Fullstack

AIGC fullstack monorepo for user-facing generation workflows, operations admin, business API, and AI worker services.

## Tech Stack

```txt
Monorepo: pnpm workspace + Turborepo
Web: Vue 3 + TypeScript + Vite + chadcn/vue
Admin: Vue 3 + TypeScript + Vite + Element Plus
API: NestJS + Prisma + MySQL
AI Service: FastAPI + uv
Queue: RabbitMQ
Cache: Redis
Storage: COS/OSS/S3 compatible object storage
Local storage emulator: MinIO
```

## Repository Layout

```txt
apps/
  web/          User-facing Vue application
  admin/        Operations admin Vue application
  api/          NestJS business API
  ai-service/   FastAPI AI service and workers

packages/
  shared-contracts/  Shared enums, event names, queue names, and API contracts
  shared-config/     Shared TypeScript and tooling config
  shared-utils/      Shared pure utility functions

infra/
  compose/      Local Docker Compose infrastructure

docs/           Architecture and engineering design documents
scripts/        Development, migration, and seed scripts
```

## Prerequisites

Recommended versions:

```txt
Node.js 22 LTS
pnpm 10.x
Python 3.12
uv
Docker
Docker Compose
```

## Install

```bash
pnpm install
```

For the Python AI service:

```bash
cd apps/ai-service
uv sync
```

## Local Infrastructure

```bash
docker compose -f infra/compose/docker-compose.yml up -d
```

Services:

```txt
MySQL: localhost:3306
Redis: localhost:6379
RabbitMQ: localhost:5672
RabbitMQ Management: http://localhost:15672
MinIO API: http://localhost:9000
MinIO Console: http://localhost:9001
```

Default local credentials are only for development and are defined in `infra/compose/docker-compose.yml`.

## Development

Run all Node workspace dev tasks:

```bash
pnpm dev
```

Run a single app:

```bash
pnpm --filter @aigc/web dev
pnpm --filter @aigc/admin dev
pnpm --filter @aigc/api dev
```

Run the AI service:

```bash
cd apps/ai-service
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

## Build And Checks

```bash
pnpm build
pnpm lint
pnpm test
pnpm typecheck
```

## Architecture

Main runtime flow:

```txt
apps/web or apps/admin
  |
  | HTTP / SSE
  v
apps/api NestJS
  |
  | Prisma / MySQL
  v
MySQL

apps/api NestJS
  |
  | RabbitMQ
  v
apps/ai-service FastAPI Worker
  |
  | SDK / HTTP / Workflow
  v
Model providers / ComfyUI / internal models
```

Key design documents:

- [Monorepo Architecture](./docs/aigc-monorepo-architecture.md)
- [Backend Architecture](./docs/aigc-backend-fastapi-nestjs-architecture.md)
- [Queue Design](./docs/aigc-queue-rabbitmq-vs-bullmq.md)
- [Realtime Push](./docs/aigc-realtime-sse-vs-websocket.md)
- [Idempotency And Attempt Model](./docs/aigc-idempotency-and-attempt.md)
- [Billing Consistency](./docs/aigc-billing-consistency.md)
- [Asset Lifecycle](./docs/aigc-asset-lifecycle-and-storage.md)
- [Moderation And Risk Control](./docs/aigc-moderation-and-risk-control.md)
- [Observability And Ops](./docs/aigc-observability-and-ops.md)

## Current Scope

This repository currently contains the monorepo foundation and architecture documents. The first implementation milestone is a mock end-to-end generation flow:

```txt
Web -> API -> MySQL -> RabbitMQ -> AI Service -> RabbitMQ -> API -> SSE -> Web
```
