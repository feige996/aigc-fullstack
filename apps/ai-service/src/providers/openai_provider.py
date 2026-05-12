from ..config import settings
from ..contracts import GenerationRequestMessage
from .base import GenerationProvider, ProviderError, ProviderResult


class OpenAIProvider(GenerationProvider):
    name = "openai"

    @property
    def enabled(self) -> bool:
        return bool(settings.openai_api_key)

    async def generate(self, task: GenerationRequestMessage) -> ProviderResult:
        if not self.enabled:
            raise ProviderError(
                code="PROVIDER_NOT_CONFIGURED",
                message="OpenAI provider is not configured. Set OPENAI_API_KEY to enable it.",
                retryable=False,
            )

        raise ProviderError(
            code="PROVIDER_NOT_CONFIGURED",
            message=f"OpenAI provider adapter is not implemented for model {task.model}.",
            retryable=False,
        )
