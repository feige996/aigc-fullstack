from io import BytesIO

from minio import Minio
from minio.error import S3Error

from .config import settings


class ObjectStorage:
    def __init__(self) -> None:
        self.bucket = settings.object_storage_bucket
        self.client = Minio(
            settings.object_storage_endpoint.replace("http://", "").replace("https://", ""),
            access_key=settings.object_storage_access_key,
            secret_key=settings.object_storage_secret_key,
            secure=settings.object_storage_secure,
            region=settings.object_storage_region,
        )

    def ensure_bucket(self) -> None:
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
        except S3Error as error:
            if error.code != "BucketAlreadyOwnedByYou":
                raise

    def put_bytes(self, object_key: str, body: bytes, content_type: str) -> str:
        self.ensure_bucket()
        self.client.put_object(
            self.bucket,
            object_key,
            BytesIO(body),
            length=len(body),
            content_type=content_type,
        )
        return f"s3://{self.bucket}/{object_key}"
