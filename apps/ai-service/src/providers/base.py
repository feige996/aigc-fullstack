from abc import ABC, abstractmethod
from dataclasses import dataclass

from ..contracts import TaskRequestMessage, TaskResultOutput, TaskResultUsage


@dataclass(frozen=True)
class ProviderResult:
    provider: str
    outputs: list[TaskResultOutput]
    usage: TaskResultUsage | None = None
    provider_task_id: str | None = None


@dataclass(frozen=True)
class ProviderError(Exception):
    code: str
    message: str
    retryable: bool = True
    stage: str = "provider_generate"
    provider: str | None = None


class TaskProvider(ABC):
    name: str

    @abstractmethod
    async def generate(self, task: TaskRequestMessage) -> ProviderResult:
        raise NotImplementedError
