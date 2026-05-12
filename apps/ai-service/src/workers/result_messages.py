from dataclasses import dataclass

from ..contracts import TaskRequestMessage, TaskResultMessage
from ..providers.base import ProviderError, ProviderResult
from ..rabbitmq import TASK_FAILED_ROUTING_KEY, TASK_SUCCEEDED_ROUTING_KEY


@dataclass(frozen=True)
class WorkerResult:
    message: TaskResultMessage
    routing_key: str


def build_success_result(task: TaskRequestMessage, provider_result: ProviderResult) -> WorkerResult:
    return WorkerResult(
        message=TaskResultMessage(
            traceId=task.trace_id,
            taskId=task.task_id,
            attemptId=task.attempt_id,
            status="succeeded",
            provider=provider_result.provider,
            outputs=provider_result.outputs,
            usage=provider_result.usage,
            error=None,
        ),
        routing_key=TASK_SUCCEEDED_ROUTING_KEY,
    )


def build_failed_result(task: TaskRequestMessage, error: ProviderError) -> WorkerResult:
    return WorkerResult(
        message=TaskResultMessage(
            traceId=task.trace_id,
            taskId=task.task_id,
            attemptId=task.attempt_id,
            status="failed",
            provider="unknown",
            outputs=[],
            usage=None,
            error={
                "code": error.code,
                "message": error.message,
                "retryable": error.retryable,
            },
        ),
        routing_key=TASK_FAILED_ROUTING_KEY,
    )
