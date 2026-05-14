import asyncio
import logging

from .rabbitmq import connect
from .workers.image_generate_worker import ImageGenerateWorker
from .observability import log_json


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    log_json("info", "worker_start", service="ai-service")

    connection = await connect()
    try:
        worker = ImageGenerateWorker(connection)
        await worker.run()
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
