# 模型 Provider 架构

## 目标

AI Service 不直接把某个供应商 SDK 写进 Worker。Worker 只接收任务消息、校验执行状态、调用 Provider Registry，然后把统一结果发布回 RabbitMQ。

这样接入通义、火山、腾讯、OpenAI、ComfyUI 或自研模型时，只需要新增 provider adapter。

## 当前实现

当前第一版实现 `mock` provider，并提供 `openai` placeholder adapter。

`mock` provider 会生成一个 1x1 PNG 占位文件，上传到对象存储，并在结果消息中返回 `s3://bucket/objectKey`。

`openai` provider 当前只注册路由和配置检查，不真实调用 OpenAI API。未配置或未实现时会抛 `PROVIDER_NOT_CONFIGURED`，且 `retryable=false`。

```txt
ImageGenerateWorker
  -> ProviderRegistry
  -> MockProvider
  -> result_messages
  -> RabbitMQ task.result
```

当前代码位置：

```txt
apps/ai-service/src/worker_main.py
apps/ai-service/src/workers/image_generate_worker.py
apps/ai-service/src/workers/result_messages.py
apps/ai-service/src/providers/
apps/ai-service/src/storage.py
```

职责边界：

- `worker_main.py` 是 Worker 进程入口，只负责连接 RabbitMQ 和启动具体 Worker。
- `image_generate_worker.py` 负责消费图片生成队列、校验 attempt 是否仍可执行、调用 Provider Registry，并发布结果。
- `result_messages.py` 负责把 provider 成功/失败结果转换为统一 `TaskResultMessage` 和 RabbitMQ routing key。
- `providers/registry.py` 负责根据 `model` 解析 provider。
- `providers/base.py` 定义 provider adapter 接口、成功结果和统一错误。
- `providers/mock_provider.py` 是当前 mock adapter。
- `providers/openai_provider.py` 是 OpenAI placeholder adapter。
- `storage.py` 是 AI Service 侧对象存储写入适配器，当前使用 MinIO/S3 兼容协议。

Worker 不直接写某个真实供应商 SDK，也不直接决定业务最终状态；它只发布统一结果消息，最终状态仍由 NestJS API 消费后落库。

## 配置

```txt
MODEL_PROVIDER=mock
PROVIDER_TIMEOUT_SECONDS=60
PROVIDER_MAX_RETRIES=0
PROVIDER_MOCK_LATENCY_SECONDS=1
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OBJECT_STORAGE_ENDPOINT=localhost:9000
OBJECT_STORAGE_BUCKET=aigc-assets
OBJECT_STORAGE_ACCESS_KEY=minioadmin
OBJECT_STORAGE_SECRET_KEY=minioadmin
OBJECT_STORAGE_SECURE=false
```

模型字段支持两种方式：

```txt
mock-image-v1
mock:mock-image-v1
openai:gpt-image-1
```

如果 `model` 包含 `provider:modelName`，Provider Registry 使用冒号前面的 provider 名称。

如果 `model` 不包含 provider 前缀，则使用 `MODEL_PROVIDER`。

如果 `model` 使用了未注册 provider 前缀，或 provider 未配置，Worker 会返回失败结果，API 会把任务标记为 `failed`，失败码当前统一落为 `PROVIDER_FAILED`。

## Provider 接口

每个 provider adapter 实现：

```py
class GenerationProvider:
    name: str

    async def generate(self, task: TaskRequestMessage) -> ProviderResult:
        ...
```

统一返回：

```py
ProviderResult(
    provider="mock-provider",
    outputs=[...],
    usage=...
)
```

统一失败：

```py
ProviderError(
    code="PROVIDER_NOT_CONFIGURED",
    message="...",
    retryable=False,
)
```

## 错误映射建议

后续真实 provider 接入时，供应商错误应统一映射到稳定错误码：

| 场景 | 建议错误码 | retryable |
| --- | --- | --- |
| 供应商超时 | `PROVIDER_TIMEOUT` | true |
| 供应商限流 | `PROVIDER_RATE_LIMITED` | true |
| 供应商拒绝输入 | `PROVIDER_REJECTED` | false |
| 供应商内部失败 | `PROVIDER_FAILED` | true |
| 本地配置缺失 | `PROVIDER_NOT_CONFIGURED` | false |

## 下一步

1. 增加第一个真实 provider adapter。
2. 把 provider 返回的结果 URL 下载并转存到对象存储。
3. 让 NestJS API 在消费结果时落 `Asset` 元数据。
4. 增加 provider 级别的超时、重试、限流和熔断配置。

真实 provider 接入建议放在：

```txt
apps/ai-service/src/providers/<provider_name>_provider.py
```

接入时只修改：

- 新增 provider adapter。
- 在 `create_provider_registry()` 注册 provider。
- 根据需要补充 provider 配置项。

不建议在 `image_generate_worker.py` 里直接写供应商 SDK 调用。
