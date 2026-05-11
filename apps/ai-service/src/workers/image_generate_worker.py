import json
import logging
import asyncio

import aio_pika
import httpx
from pydantic import ValidationError

from ..config import settings
from ..contracts import (
    GenerationExecutionState,
    GenerationRequestMessage,
    GenerationResultMessage,
    GenerationResultOutput,
    GenerationResultUsage,
)
from ..rabbitmq import (
    GENERATION_RESULT_EXCHANGE,
    GENERATION_REQUEST_EXCHANGE,
    IMAGE_GENERATE_QUEUE,
    IMAGE_GENERATE_ROUTING_KEY,
    TASK_SUCCEEDED_ROUTING_KEY,
)

logger = logging.getLogger(__name__)


class ImageGenerateWorker:
    def __init__(self, connection: aio_pika.RobustConnection) -> None:
        self.connection = connection

    async def run(self) -> None:
        channel = await self.connection.channel()
        await channel.set_qos(prefetch_count=1)

        exchange = await channel.declare_exchange(
            GENERATION_REQUEST_EXCHANGE,
            aio_pika.ExchangeType.DIRECT,
            durable=True,
        )
        result_exchange = await channel.declare_exchange(
            GENERATION_RESULT_EXCHANGE,
            aio_pika.ExchangeType.DIRECT,
            durable=True,
        )
        queue = await channel.declare_queue(IMAGE_GENERATE_QUEUE, durable=True)
        await queue.bind(exchange, routing_key=IMAGE_GENERATE_ROUTING_KEY)

        logger.info("Consuming %s with routing key %s", IMAGE_GENERATE_QUEUE, IMAGE_GENERATE_ROUTING_KEY)

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
                task = GenerationRequestMessage.model_validate(payload)
            except (json.JSONDecodeError, UnicodeDecodeError, ValidationError):
                logger.exception("Invalid generation request message")
                return

            logger.info(
                "Received image generation task task_id=%s attempt_id=%s model=%s prompt=%s",
                task.task_id,
                task.attempt_id,
                task.model,
                task.input.prompt,
            )

            execution_state = await self.fetch_execution_state(task)
            if not execution_state.executable:
                logger.info(
                    "Skipped non-executable task task_id=%s attempt_id=%s reason=%s",
                    task.task_id,
                    task.attempt_id,
                    execution_state.reason,
                )
                return

            await asyncio.sleep(1)
            result = GenerationResultMessage(
                traceId=task.trace_id,
                taskId=task.task_id,
                attemptId=task.attempt_id,
                status="succeeded",
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
                error=None,
            )

            await result_exchange.publish(
                aio_pika.Message(
                    body=result.model_dump_json(by_alias=True).encode("utf-8"),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key=TASK_SUCCEEDED_ROUTING_KEY,
            )
            logger.info("Published mock success result task_id=%s", task.task_id)

    async def fetch_execution_state(self, task: GenerationRequestMessage) -> GenerationExecutionState:
        url = f"{settings.api_base_url}/generation/tasks/{task.task_id}/attempts/{task.attempt_id}/execution-state"

        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(url)
                response.raise_for_status()
                return GenerationExecutionState.model_validate(response.json())
        except (httpx.HTTPError, ValidationError):
            logger.exception(
                "Failed to validate execution state task_id=%s attempt_id=%s",
                task.task_id,
                task.attempt_id,
            )
            return GenerationExecutionState(executable=False, reason="EXECUTION_STATE_UNAVAILABLE")
