import json
import logging

import aio_pika
from pydantic import ValidationError

from ..contracts import GenerationRequestMessage
from ..rabbitmq import (
    GENERATION_REQUEST_EXCHANGE,
    IMAGE_GENERATE_QUEUE,
    IMAGE_GENERATE_ROUTING_KEY,
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
        queue = await channel.declare_queue(IMAGE_GENERATE_QUEUE, durable=True)
        await queue.bind(exchange, routing_key=IMAGE_GENERATE_ROUTING_KEY)

        logger.info("Consuming %s with routing key %s", IMAGE_GENERATE_QUEUE, IMAGE_GENERATE_ROUTING_KEY)

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                await self.handle_message(message)

    async def handle_message(self, message: aio_pika.IncomingMessage) -> None:
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
