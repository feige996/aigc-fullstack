import asyncio
import logging

from .rabbitmq import connect
from .workers.image_generate_worker import ImageGenerateWorker


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    connection = await connect()
    try:
        worker = ImageGenerateWorker(connection)
        await worker.run()
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
