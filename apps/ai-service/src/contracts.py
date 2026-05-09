from pydantic import BaseModel, Field


class GenerationInput(BaseModel):
    prompt: str
    ratio: str | None = None
    duration: int | None = None
    reference_asset_ids: list[str] = Field(default_factory=list, alias="referenceAssetIds")


class GenerationRequestMessage(BaseModel):
    trace_id: str = Field(alias="traceId")
    task_id: str = Field(alias="taskId")
    attempt_id: str = Field(alias="attemptId")
    user_id: str = Field(alias="userId")
    type: str
    model: str
    input: GenerationInput
    idempotency_key: str = Field(alias="idempotencyKey")
    attempt: int
