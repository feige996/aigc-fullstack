# Local Browser Verification

This guide verifies the current mock generation flow in a browser and with a command-line smoke script:

```txt
Web -> API -> MySQL -> RabbitMQ -> AI worker -> RabbitMQ -> API -> SSE -> Web/Admin
```

## Prerequisites

Use the existing local infrastructure:

```txt
MySQL: mysql-novel or aigc-mysql on localhost:3306
RabbitMQ: aigc-rabbitmq on localhost:5672 and http://localhost:15672
Redis: aigc-redis on localhost:6379
```

Current development credentials:

```txt
DATABASE_URL=mysql://aigc:aigc_password@localhost:3306/aigc
RABBITMQ_URL=amqp://aigc:aigc_password@localhost:5672/
RabbitMQ Management: aigc / aigc_password
```

If containers are not running, start the compose stack:

```bash
docker compose -f infra/compose/docker-compose.yml up -d
```

If you are reusing the existing `mysql-novel` container, do not start another MySQL container on port `3306`.

## Start The Apps

Open four terminal tabs from the repository root.

### 1. API

```bash
DATABASE_URL='mysql://aigc:aigc_password@localhost:3306/aigc' \
RABBITMQ_URL='amqp://aigc:aigc_password@localhost:5672/' \
pnpm --filter @aigc/api dev
```

Expected API URL:

```txt
http://localhost:3000/api
```

### 2. AI Worker

```bash
cd apps/ai-service
RABBITMQ_URL='amqp://aigc:aigc_password@localhost:5672/' \
API_BASE_URL='http://localhost:3000/api' \
.venv/bin/python -m src.worker_main
```

The worker should log that it is consuming `image.generate.queue`.

### 3. Web

```bash
pnpm --filter @aigc/web dev
```

Open:

```txt
http://localhost:5173
```

### 4. Admin

```bash
pnpm --filter @aigc/admin dev
```

Open:

```txt
http://localhost:5174
```

## Verify In Browser

### Web

1. Open `http://localhost:5173`.
2. Confirm the SSE status becomes `open`.
3. Enter a prompt, for example `a clean product photo of a ceramic cup`.
4. Click `Submit Task`.
5. The current task should first show `queued`.
6. After the worker handles it, the task should become `succeeded`.
7. The recent task list should refresh automatically.

### Cancel Flow

1. Submit another task.
2. Click `Cancel` before the worker completes it.
3. The task should become `canceled`.
4. `failureCode` should be `USER_CANCELED`.
5. If the worker later consumes the queued message, it should log that the task is not executable and skip it.

### Admin

1. Open `http://localhost:5174`.
2. Click `Refresh`.
3. Select a task in the table.
4. Confirm task details and attempts are visible.
5. For failed or canceled tasks, try `Retry`.
6. For active tasks, try `Cancel`.

## Verify With Smoke Script

The smoke script checks the API, worker, asset, and download path without opening a browser:

```txt
Login -> /auth/me -> create generation task -> poll task detail -> expect succeeded -> download output asset
```

It requires:

- API running at `http://localhost:3000/api`.
- AI Worker running and consuming `image.generate.queue`.
- RabbitMQ and MySQL running.
- The demo user exists.

Default credentials:

```txt
Phone: 13900139000
Password: password123
```

Run from the repository root:

```bash
pnpm smoke:generation
```

Use a different API URL or account:

```bash
API_BASE_URL='http://localhost:3001/api' \
SMOKE_PHONE_NUMBER='13900139000' \
SMOKE_PASSWORD='password123' \
pnpm smoke:generation
```

Useful options:

```txt
SMOKE_PROMPT       Prompt text. Default: smoke test product photo
SMOKE_TIMEOUT_MS   Poll timeout. Default: 30000
SMOKE_INTERVAL_MS  Poll interval. Default: 1000
```

Expected output shape:

```txt
[smoke] authenticated user=13900139000 role=super_admin
[smoke] profile id=...
[smoke] created task=... status=queued
[smoke] poll task=... status=queued
[smoke] poll task=... status=succeeded
[smoke] final task=... status=succeeded stage=completed
[smoke] output assets=1 first=aigc/mock/.../output.png
[smoke] download status=200 contentType=image/png bytes=68
```

## Verify RabbitMQ

Open RabbitMQ Management:

```txt
http://localhost:15672
```

Login:

```txt
Username: aigc
Password: aigc_password
```

Important queues:

```txt
image.generate.queue
generation.result.persist.queue
```

During normal idle state, both queues should usually have `0` messages. If the AI worker is not running, `image.generate.queue` may accumulate messages.

## Useful API Checks

List tasks:

```bash
TOKEN=$(curl -sS -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"13900139000","password":"password123"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).accessToken')

curl -sS http://localhost:3000/api/generation/tasks \
  -H "Authorization: Bearer $TOKEN"
```

Create a task:

```bash
curl -sS -X POST http://localhost:3000/api/generation/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"type":"text_to_image","model":"mock-image-v1","prompt":"browser verification","ratio":"1:1","referenceAssetIds":[]}'
```

Cancel a task:

```bash
curl -sS -X POST http://localhost:3000/api/generation/tasks/<taskId>/cancel \
  -H "Authorization: Bearer $TOKEN"
```

Check queues:

```bash
docker exec aigc-rabbitmq rabbitmqctl list_queues name messages consumers
```

## Common Issues

### Port 3000 Is Already Used

Check which process is listening:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Stop the old API dev process or start the API with another `PORT`.

### Task Stays Queued

Usually the worker is not running or cannot reach the API. Check:

```txt
RABBITMQ_URL
API_BASE_URL
```

Also check `image.generate.queue` in RabbitMQ Management.

If the smoke script times out, check whether the worker is running with the same API port:

```txt
API_BASE_URL=http://localhost:3000/api
```

If API was started on `PORT=3001`, the worker and smoke script must both use:

```txt
API_BASE_URL=http://localhost:3001/api
```

### API Cannot Connect To MySQL

Confirm the MySQL container and credentials:

```bash
docker ps
docker exec mysql-novel mysql -uaigc -paigc_password aigc -e 'SHOW TABLES;'
```

If using `aigc-mysql` from compose instead, replace `mysql-novel` with `aigc-mysql`.

### Cancel Does Not Remove RabbitMQ Messages

This is expected. RabbitMQ messages that were already published are not removed. The worker validates execution state before processing and skips canceled or stale attempts.
