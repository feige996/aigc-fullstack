from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_base_url: str = "http://localhost:3000/api"
    rabbitmq_url: str = "amqp://aigc:aigc_password@localhost:5672/"
    model_provider: str = "mock"
    provider_timeout_seconds: float = 60.0
    provider_max_retries: int = 0
    provider_mock_latency_seconds: float = 1.0
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    object_storage_endpoint: str = "localhost:9000"
    object_storage_bucket: str = "aigc-assets"
    object_storage_region: str = "local"
    object_storage_access_key: str = "minioadmin"
    object_storage_secret_key: str = "minioadmin"
    object_storage_secure: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        extra="ignore",
    )


settings = Settings()
