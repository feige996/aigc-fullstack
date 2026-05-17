from src.contracts import TaskRequestMessage, TaskResultOutput, TaskResultUsage
from src.providers.base import ProviderError, ProviderResult
from src.rabbitmq import TASK_FAILED_ROUTING_KEY, TASK_SUCCEEDED_ROUTING_KEY
from src.workers.result_messages import build_failed_result, build_success_result


def make_task() -> TaskRequestMessage:
    return TaskRequestMessage.model_validate(
        {
            "traceId": "trace_1",
            "taskId": "task_1",
            "attemptId": "attempt_1",
            "userId": "user_1",
            "domain": "aigc_generation",
            "type": "text_to_image",
            "capability": "image_generation",
            "model": "mock-image-v1",
            "input": {
                "prompt": "product photo",
                "ratio": "1:1",
                "referenceAssetIds": [],
            },
            "idempotencyKey": "task_1:1",
            "attempt": 1,
        }
    )


def test_build_success_result_preserves_task_identity_and_provider_output() -> None:
    task = make_task()
    provider_result = ProviderResult(
        provider="mock-provider",
        outputs=[
            TaskResultOutput(
                type="image",
                objectPath="s3://aigc-assets/aigc/mock/user_1/task_1/output.png",
                width=1,
                height=1,
            )
        ],
        usage=TaskResultUsage(cost=1, unit="credits"),
    )

    result = build_success_result(task, provider_result)

    assert result.routing_key == TASK_SUCCEEDED_ROUTING_KEY
    assert result.message.status == "succeeded"
    assert result.message.trace_id == "trace_1"
    assert result.message.provider == "mock-provider"
    assert result.message.provider_task_id is None
    assert result.message.outputs[0].object_path.endswith("/output.png")
    assert result.message.error is None


def test_build_failed_result_returns_structured_provider_error() -> None:
    result = build_failed_result(
        make_task(),
        ProviderError(code="PROVIDER_TIMEOUT", message="provider timed out", retryable=True),
        provider="mock",
        stage="provider_generate",
    )

    assert result.routing_key == TASK_FAILED_ROUTING_KEY
    assert result.message.status == "failed"
    assert result.message.provider == "mock"
    assert result.message.outputs == []
    assert result.message.error == {
        "code": "PROVIDER_TIMEOUT",
        "message": "provider timed out",
        "retryable": True,
        "type": "ProviderError",
        "class": "src.providers.base.ProviderError",
        "stage": "provider_generate",
        "provider": "mock",
    }
