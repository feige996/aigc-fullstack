from abc import ABC, abstractmethod
from dataclasses import dataclass

from ..contracts import TaskRequestMessage, TaskResultOutput, TaskResultUsage


@dataclass(frozen=True)
class ProviderResult:
    provider: str
    outputs: list[TaskResultOutput]
    usage: TaskResultUsage | None = None


@dataclass(frozen=True)
class ProviderError(Exception):
    code: str
    message: str
    retryable: bool = True


class TaskProvider(ABC):
    name: str

    @abstractmethod
    async def generate(self, task: TaskRequestMessage) -> ProviderResult:
        raise NotImplementedError
