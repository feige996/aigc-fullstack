import asyncio
import base64

from ..config import settings
from ..contracts import GenerationRequestMessage, GenerationResultOutput, GenerationResultUsage
from ..storage import ObjectStorage
from .base import GenerationProvider, ProviderResult

MOCK_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
)


class MockProvider(GenerationProvider):
    name = "mock"

    def __init__(self, object_storage: ObjectStorage) -> None:
        self.object_storage = object_storage

    async def generate(self, task: GenerationRequestMessage) -> ProviderResult:
        await asyncio.sleep(settings.provider_mock_latency_seconds)
        object_key = f"aigc/mock/{task.user_id}/{task.task_id}/output.png"
        object_path = await asyncio.to_thread(self.object_storage.put_bytes, object_key, MOCK_PNG, "image/png")

        return ProviderResult(
            provider="mock-provider",
            outputs=[
                GenerationResultOutput(
                    type="image",
                    objectPath=object_path,
                    previewUrl=f"https://example.invalid/preview/{task.task_id}.png",
                    width=1,
                    height=1,
                )
            ],
            usage=GenerationResultUsage(cost=1, unit="credits"),
        )
