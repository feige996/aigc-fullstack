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


class GenerationExecutionState(BaseModel):
    executable: bool
    reason: str | None = None
    task_status: str | None = Field(default=None, alias="taskStatus")
    attempt_status: str | None = Field(default=None, alias="attemptStatus")
    current_attempt_id: str | None = Field(default=None, alias="currentAttemptId")


class GenerationResultOutput(BaseModel):
    type: str
    object_path: str = Field(alias="objectPath")
    preview_url: str | None = Field(default=None, alias="previewUrl")
    width: int | None = None
    height: int | None = None
    duration: int | None = None


class GenerationResultUsage(BaseModel):
    cost: int
    unit: str


class GenerationResultMessage(BaseModel):
    trace_id: str = Field(alias="traceId")
    task_id: str = Field(alias="taskId")
    attempt_id: str = Field(alias="attemptId")
    status: str
    provider: str
    outputs: list[GenerationResultOutput]
    usage: GenerationResultUsage | None = None
    error: dict | None = None
