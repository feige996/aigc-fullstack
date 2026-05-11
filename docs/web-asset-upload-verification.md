# Web Asset Upload Verification

This verifies the browser upload flow through the backend asset API and MinIO.

## Prerequisites

Start MySQL, RabbitMQ, and MinIO:

```bash
docker compose -f infra/compose/docker-compose.yml up -d mysql rabbitmq minio
```

Create the MinIO bucket if it does not exist:

```bash
docker exec aigc-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec aigc-minio mc mb --ignore-existing local/aigc-assets
```

Start the API with object storage environment variables:

```bash
DATABASE_URL='mysql://aigc:aigc_password@localhost:3306/aigc' \
RABBITMQ_URL='amqp://aigc:aigc_password@localhost:5672/' \
OBJECT_STORAGE_PROVIDER='minio' \
OBJECT_STORAGE_ENDPOINT='http://localhost:9000' \
OBJECT_STORAGE_BUCKET='aigc-assets' \
OBJECT_STORAGE_REGION='local' \
OBJECT_STORAGE_ACCESS_KEY='minioadmin' \
OBJECT_STORAGE_SECRET_KEY='minioadmin' \
pnpm --filter @aigc/api dev
```

Start Web:

```bash
pnpm --filter @aigc/web dev
```

## Browser Steps

1. Log in to Web.
2. Create or select a project.
3. In `Assets`, choose a local file.
4. Confirm the page shows `Asset uploaded.`
5. Confirm the uploaded asset is selected in `Reference Assets`.
6. Submit a generation task.
7. Open the current task detail and confirm `Assets` contains the uploaded asset id.

## Expected API Flow

The browser performs:

1. `POST /api/assets/uploads`
2. `PUT <presigned MinIO URL>`
3. `POST /api/assets/:assetId/confirm`
4. `POST /api/generation/tasks` with `referenceAssetIds`

## MinIO Console

Open:

```txt
http://localhost:9001
```

Login:

```txt
minioadmin / minioadmin
```

The uploaded object should be under:

```txt
aigc-assets/aigc/dev/temp/<date>/<assetId>.<ext>
```
