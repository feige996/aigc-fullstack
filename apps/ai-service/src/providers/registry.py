from ..config import settings
from ..contracts import GenerationRequestMessage
from ..storage import ObjectStorage
from .base import GenerationProvider, ProviderError, ProviderResult
from .mock_provider import MockProvider
from .openai_provider import OpenAIProvider


class ProviderRegistry:
    def __init__(self, providers: list[GenerationProvider], default_provider_name: str) -> None:
        self.providers = {provider.name: provider for provider in providers}
        self.default_provider_name = default_provider_name

    async def generate(self, task: GenerationRequestMessage) -> ProviderResult:
        provider = self.resolve(task.model)
        return await provider.generate(task)

    def resolve(self, model: str) -> GenerationProvider:
        provider_name = self.provider_name_from_model(model)
        provider = self.providers.get(provider_name)

        if provider is None:
            raise ProviderError(
                code="PROVIDER_NOT_CONFIGURED",
                message=f"Provider {provider_name} is not configured for model {model}",
                retryable=False,
            )

        return provider

    def provider_name_from_model(self, model: str) -> str:
        if ":" in model:
            provider_name, _ = model.split(":", 1)
            return provider_name

        return self.default_provider_name


def create_provider_registry() -> ProviderRegistry:
    object_storage = ObjectStorage()

    return ProviderRegistry(
        providers=[
            MockProvider(object_storage),
            OpenAIProvider(),
        ],
        default_provider_name=settings.model_provider,
    )
