from abc import ABC, abstractmethod
from dataclasses import dataclass

from ..contracts import GenerationRequestMessage, GenerationResultOutput, GenerationResultUsage


@dataclass(frozen=True)
class ProviderResult:
    provider: str
    outputs: list[GenerationResultOutput]
    usage: GenerationResultUsage | None = None


@dataclass(frozen=True)
class ProviderError(Exception):
    code: str
    message: str
    retryable: bool = True


class GenerationProvider(ABC):
    name: str

    @abstractmethod
    async def generate(self, task: GenerationRequestMessage) -> ProviderResult:
        raise NotImplementedError
