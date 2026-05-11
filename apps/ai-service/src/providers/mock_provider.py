import asyncio

from ..config import settings
from ..contracts import GenerationRequestMessage, GenerationResultOutput, GenerationResultUsage
from .base import GenerationProvider, ProviderResult


class MockProvider(GenerationProvider):
    name = "mock"

    async def generate(self, task: GenerationRequestMessage) -> ProviderResult:
        await asyncio.sleep(settings.provider_mock_latency_seconds)

        return ProviderResult(
            provider="mock-provider",
            outputs=[
                GenerationResultOutput(
                    type="image",
                    objectPath=f"aigc/mock/{task.user_id}/{task.task_id}/output.png",
                    previewUrl=f"https://example.invalid/preview/{task.task_id}.png",
                    width=1024,
                    height=1024,
                )
            ],
            usage=GenerationResultUsage(cost=1, unit="credits"),
        )
