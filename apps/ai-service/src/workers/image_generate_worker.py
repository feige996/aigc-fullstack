import json
import logging

import aio_pika
import httpx
from pydantic import ValidationError

from ..config import settings
from ..contracts import (
    TaskExecutionState,
    TaskRequestMessage,
)
from ..observability import RequestContext, create_request_context, log_json, masked_prompt
from ..providers import create_provider_registry
from ..providers.base import ProviderError
from ..rabbitmq import (
    IMAGE_GENERATE_QUEUE,
    IMAGE_GENERATE_ROUTING_KEY,
    TASK_REQUEST_EXCHANGE,
    TASK_RESULT_EXCHANGE,
)
from .result_messages import build_failed_result, build_success_result

logger = logging.getLogger(__name__)


class ImageGenerateWorker:
    def __init__(self, connection: aio_pika.RobustConnection) -> None:
        self.connection = connection
        self.provider_registry = create_provider_registry()

    async def run(self) -> None:
        channel = await self.connection.channel()
        await channel.set_qos(prefetch_count=1)

        exchange = await channel.declare_exchange(
            TASK_REQUEST_EXCHANGE,
            aio_pika.ExchangeType.DIRECT,
            durable=True,
        )
        result_exchange = await channel.declare_exchange(
            TASK_RESULT_EXCHANGE,
            aio_pika.ExchangeType.DIRECT,
            durable=True,
        )
        queue = await channel.declare_queue(IMAGE_GENERATE_QUEUE, durable=True)
        await queue.bind(exchange, routing_key=IMAGE_GENERATE_ROUTING_KEY)

        log_json(
            "info",
            "worker_consume",
            queue=IMAGE_GENERATE_QUEUE,
            routingKey=IMAGE_GENERATE_ROUTING_KEY,
        )

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                await self.handle_message(message, result_exchange)

    async def handle_message(
        self,
        message: aio_pika.IncomingMessage,
        result_exchange: aio_pika.abc.AbstractExchange,
    ) -> None:
        async with message.process(requeue=False):
            try:
                payload = json.loads(message.body.decode("utf-8"))
                task = TaskRequestMessage.model_validate(payload)
            except (json.JSONDecodeError, UnicodeDecodeError, ValidationError):
                logger.exception("Invalid task request message")
                log_json("warn", "worker_invalid_message")
                return

            context = create_request_context(trace_id=task.trace_id)
            logger.info(
                "Received image task task_id=%s attempt_id=%s model=%s prompt=%s",
                task.task_id,
                task.attempt_id,
                task.model,
                masked_prompt(task.input.prompt),
            )
            log_json(
                "info",
                "worker_task_received",
                requestId=context.request_id,
                traceId=context.trace_id,
                taskId=task.task_id,
                attemptId=task.attempt_id,
                model=task.model,
                provider=settings.model_provider,
            )

            execution_state = await self.fetch_execution_state(task, context)
            if not execution_state.executable:
                logger.info(
                    "Skipped non-executable task task_id=%s attempt_id=%s reason=%s",
                    task.task_id,
                    task.attempt_id,
                    execution_state.reason,
                )
                log_json(
                    "info",
                    "worker_task_skipped",
                    requestId=context.request_id,
                    traceId=context.trace_id,
                    taskId=task.task_id,
                    attemptId=task.attempt_id,
                    reason=execution_state.reason,
                )
                return

            try:
                provider_result = await self.provider_registry.generate(task)
                worker_result = build_success_result(task, provider_result)
            except ProviderError as error:
                provider = self.provider_registry.provider_name_from_model(task.model)
                worker_result = build_failed_result(task, error, provider=provider, stage="provider_generate")

            await result_exchange.publish(
                aio_pika.Message(
                    body=worker_result.message.model_dump_json(by_alias=True).encode("utf-8"),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key=worker_result.routing_key,
            )
            logger.info(
                "Published provider result task_id=%s status=%s routing_key=%s",
                task.task_id,
                worker_result.message.status,
                worker_result.routing_key,
            )
            log_json(
                "info",
                "worker_result_published",
                requestId=context.request_id,
                traceId=context.trace_id,
                taskId=task.task_id,
                attemptId=task.attempt_id,
                status=worker_result.message.status,
                routingKey=worker_result.routing_key,
            )

    async def fetch_execution_state(
        self,
        task: TaskRequestMessage,
        context: RequestContext,
    ) -> TaskExecutionState:
        url = f"{settings.api_base_url}/generation/tasks/{task.task_id}/attempts/{task.attempt_id}/execution-state"

        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(
                    url,
                    headers={
                        "x-request-id": context.request_id,
                        "x-trace-id": context.trace_id,
                    },
                )
                response.raise_for_status()
                return TaskExecutionState.model_validate(response.json())
        except (httpx.HTTPError, ValidationError):
            logger.exception(
                "Failed to validate execution state task_id=%s attempt_id=%s",
                task.task_id,
                task.attempt_id,
            )
            log_json(
                "warn",
                "worker_execution_state_error",
                requestId=context.request_id,
                traceId=context.trace_id,
                taskId=task.task_id,
                attemptId=task.attempt_id,
            )
            return TaskExecutionState(executable=False, reason="EXECUTION_STATE_UNAVAILABLE")
