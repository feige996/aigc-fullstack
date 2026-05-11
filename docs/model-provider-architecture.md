# 模型 Provider 架构

## 目标

AI Service 不直接把某个供应商 SDK 写进 Worker。Worker 只接收任务消息、校验执行状态、调用 Provider Registry，然后把统一结果发布回 RabbitMQ。

这样接入通义、火山、腾讯、OpenAI、ComfyUI 或自研模型时，只需要新增 provider adapter。

## 当前实现

当前第一版只实现 `mock` provider。

```txt
ImageGenerateWorker
  -> ProviderRegistry
  -> MockProvider
  -> GenerationResultMessage
  -> RabbitMQ generation.result
```

## 配置

```txt
MODEL_PROVIDER=mock
PROVIDER_MOCK_LATENCY_SECONDS=1
```

模型字段支持两种方式：

```txt
mock-image-v1
mock:mock-image-v1
```

如果 `model` 包含 `provider:modelName`，Provider Registry 使用冒号前面的 provider 名称。

如果 `model` 不包含 provider 前缀，则使用 `MODEL_PROVIDER`。

## Provider 接口

每个 provider adapter 实现：

```py
class GenerationProvider:
    name: str

    async def generate(self, task: GenerationRequestMessage) -> ProviderResult:
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
