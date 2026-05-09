import aio_pika

from .config import settings

GENERATION_REQUEST_EXCHANGE = "generation.request"
GENERATION_RESULT_EXCHANGE = "generation.result"
IMAGE_GENERATE_QUEUE = "image.generate.queue"
IMAGE_GENERATE_ROUTING_KEY = "image.generate"
TASK_SUCCEEDED_ROUTING_KEY = "task.succeeded"


async def connect() -> aio_pika.RobustConnection:
    return await aio_pika.connect_robust(settings.rabbitmq_url)
