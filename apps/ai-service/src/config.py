import os
from urllib.parse import urlparse

from pydantic import ValidationInfo, field_validator, model_validator
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
    object_storage_endpoint: str = "http://localhost:9000"
    object_storage_bucket: str = "aigc-assets"
    object_storage_region: str = "local"
    object_storage_access_key: str = "minioadmin"
    object_storage_secret_key: str = "minioadmin"
    object_storage_secure: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        extra="ignore",
        validate_default=True,
    )

    @field_validator("model_provider")
    @classmethod
    def validate_model_provider(cls, value: str) -> str:
        allowed = {"mock", "openai"}
        if value not in allowed:
            raise ValueError(f"MODEL_PROVIDER must be one of: {', '.join(sorted(allowed))}")
        return value

    @field_validator("api_base_url", "rabbitmq_url", "openai_base_url", "object_storage_endpoint")
    @classmethod
    def validate_url(cls, value: str, info: ValidationInfo) -> str:
        parsed = urlparse(value)
        if not parsed.scheme or not parsed.netloc:
            raise ValueError(f"{info.field_name.upper()} must be a valid URL")

        if info.field_name == "rabbitmq_url" and parsed.scheme not in {"amqp", "amqps"}:
            raise ValueError("RABBITMQ_URL must use amqp:// or amqps://")

        if info.field_name in {"api_base_url", "openai_base_url", "object_storage_endpoint"} and parsed.scheme not in {
            "http",
            "https",
        }:
            raise ValueError(f"{info.field_name.upper()} must use http:// or https://")

        return value

    @field_validator("provider_timeout_seconds", "provider_mock_latency_seconds")
    @classmethod
    def validate_non_negative_float(cls, value: float, info: ValidationInfo) -> float:
        if value < 0:
            raise ValueError(f"{info.field_name.upper()} must be greater than or equal to 0")
        return value

    @field_validator("provider_max_retries")
    @classmethod
    def validate_non_negative_int(cls, value: int) -> int:
        if value < 0:
            raise ValueError("PROVIDER_MAX_RETRIES must be greater than or equal to 0")
        return value

    @model_validator(mode="after")
    def validate_runtime_configuration(self) -> "Settings":
        production = os.getenv("NODE_ENV", "").lower() == "production"

        if self.model_provider == "openai":
            if not self.openai_api_key or self.openai_api_key.strip().lower() in {"", "replace-me"}:
                raise ValueError("OPENAI_API_KEY is required when MODEL_PROVIDER=openai")

        if production:
            weak_values = {
                "minioadmin",
                "replace-me",
                "dev_access_secret",
                "password",
                "secret",
            }
            checks = {
                "OPENAI_API_KEY": self.openai_api_key,
                "OBJECT_STORAGE_ACCESS_KEY": self.object_storage_access_key,
                "OBJECT_STORAGE_SECRET_KEY": self.object_storage_secret_key,
            }
            for key, value in checks.items():
                if value and value.strip().lower() in weak_values:
                    raise ValueError(f"{key} must be replaced with a strong production value")

            for key, value in {
                "API_BASE_URL": self.api_base_url,
                "RABBITMQ_URL": self.rabbitmq_url,
                "OBJECT_STORAGE_ENDPOINT": self.object_storage_endpoint,
            }.items():
                parsed = urlparse(value)
                if parsed.hostname in {"localhost", "127.0.0.1", "::1"}:
                    raise ValueError(f"{key} cannot point to localhost in production")

        return self


settings = Settings()
