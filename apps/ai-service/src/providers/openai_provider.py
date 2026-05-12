from ..config import settings
from ..contracts import TaskRequestMessage
from .base import ProviderError, ProviderResult, TaskProvider


class OpenAIProvider(TaskProvider):
    name = "openai"

    @property
    def enabled(self) -> bool:
        return bool(settings.openai_api_key)

    async def generate(self, task: TaskRequestMessage) -> ProviderResult:
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
