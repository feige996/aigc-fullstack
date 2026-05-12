# Asset API

The asset module stores stable asset metadata in MySQL and signs short-lived object storage URLs through the backend.

Local development uses MinIO through the S3-compatible adapter. Production can switch to Tencent COS, Aliyun OSS, or another S3-compatible provider by changing environment variables and adding a provider adapter when needed.

## Environment

```txt
OBJECT_STORAGE_PROVIDER=minio
OBJECT_STORAGE_ENDPOINT=http://localhost:9000
OBJECT_STORAGE_BUCKET=aigc-assets
OBJECT_STORAGE_REGION=local
OBJECT_STORAGE_ACCESS_KEY=minioadmin
OBJECT_STORAGE_SECRET_KEY=minioadmin
```

## Data Model

```txt
assets
  id
  user_id
  project_id
  task_id
  type
  status
  provider
  bucket
  object_key
  mime_type
  size
  checksum
  width
  height
  duration
  expires_at
  deleted_at
  created_at
  updated_at
```

`object_key` is the stable storage path. The frontend should not persist presigned URLs.

## Create Upload

```http
POST /api/assets/uploads
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "type": "user_upload",
  "fileName": "input.png",
  "mimeType": "image/png",
  "size": 1024,
  "projectId": "optional_project_id",
  "taskId": "optional_task_id"
}
```

Response:

```json
{
  "asset": {
    "assetId": "asset_id",
    "status": "temporary",
    "bucket": "aigc-assets",
    "objectKey": "aigc/dev/temp/2026-05-11/asset_id.png"
  },
  "upload": {
    "method": "PUT",
    "url": "https://...",
    "headers": {
      "Content-Type": "image/png"
    },
    "expiresInSeconds": 900
  }
}
```

The client uploads the file directly to `upload.url` with `PUT`.

## Confirm Upload

```http
POST /api/assets/:assetId/confirm
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "size": 1024,
  "checksum": "optional-checksum"
}
```

This changes the asset from `temporary` to `active`.

## List Assets

```http
GET /api/assets
Authorization: Bearer <accessToken>
```

Users see their own assets. `admin` and `super_admin` can see all assets.

## Generated Output Assets

When the AI worker publishes a succeeded generation result, the API result consumer creates asset metadata for each output:

```txt
generation.result task.succeeded
  -> GenerationResultConsumerService
  -> assets rows with task_id
```

Current behavior:

- `type` is `model_output_raw`.
- `status` is `active`.
- `provider` comes from the provider result message.
- `object_key` comes from `outputs[].objectPath`.
- `bucket` defaults to `aigc-assets`, unless `objectPath` uses `s3://bucket/key`.
- `mime_type` is inferred from output type.
- `task_id`, `user_id`, and `project_id` are copied from the generation task.

The mock provider now writes a small placeholder PNG into MinIO and returns an `s3://bucket/key` object path. Real provider adapters should either return an object path that already points to managed storage, or a later media-processing step should copy remote outputs into object storage before marking the final asset active.

## Download URL

```http
POST /api/assets/:assetId/download
Authorization: Bearer <accessToken>
```

Returns a short-lived presigned GET URL.
