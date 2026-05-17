from pydantic import BaseModel, Field


class TaskInput(BaseModel):
    prompt: str
    ratio: str | None = None
    duration: int | None = None
    reference_asset_ids: list[str] = Field(default_factory=list, alias="referenceAssetIds")


class TaskRequestMessage(BaseModel):
    trace_id: str = Field(alias="traceId")
    task_id: str = Field(alias="taskId")
    attempt_id: str = Field(alias="attemptId")
    user_id: str = Field(alias="userId")
    domain: str = "default"
    type: str
    capability: str = "generic_execution"
    model: str
    input: TaskInput
    idempotency_key: str = Field(alias="idempotencyKey")
    attempt: int


class TaskExecutionState(BaseModel):
    executable: bool
    reason: str | None = None
    task_status: str | None = Field(default=None, alias="taskStatus")
    attempt_status: str | None = Field(default=None, alias="attemptStatus")
    current_attempt_id: str | None = Field(default=None, alias="currentAttemptId")


class TaskResultOutput(BaseModel):
    type: str
    object_path: str = Field(alias="objectPath")
    preview_url: str | None = Field(default=None, alias="previewUrl")
    width: int | None = None
    height: int | None = None
    duration: int | None = None


class TaskResultUsage(BaseModel):
    cost: int
    unit: str


class TaskResultMessage(BaseModel):
    trace_id: str = Field(alias="traceId")
    task_id: str = Field(alias="taskId")
    attempt_id: str = Field(alias="attemptId")
    status: str
    provider: str
    provider_task_id: str | None = Field(default=None, alias="providerTaskId")
    outputs: list[TaskResultOutput]
    usage: TaskResultUsage | None = None
    error: dict | None = None
