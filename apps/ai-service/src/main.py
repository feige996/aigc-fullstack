import os
import time

from fastapi import FastAPI, Request

from .observability import create_request_context, log_json, uptime_seconds

app = FastAPI(title="AIGC AI Service")
started_at = time.monotonic()


@app.middleware("http")
async def observability_middleware(request: Request, call_next):
    context = create_request_context(
        request.headers.get("x-request-id"),
        request.headers.get("x-trace-id"),
    )

    request.state.request_id = context.request_id
    request.state.trace_id = context.trace_id

    started = time.monotonic()
    response = await call_next(request)
    response.headers["x-request-id"] = context.request_id
    response.headers["x-trace-id"] = context.trace_id

    log_json(
        "info",
        "http_request",
        requestId=context.request_id,
        traceId=context.trace_id,
        method=request.method,
        path=request.url.path,
        statusCode=response.status_code,
        durationMs=int((time.monotonic() - started) * 1000),
    )

    return response


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "service": "ai-service",
        "status": "ok",
        "mode": os.getenv("MODEL_PROVIDER", "mock"),
        "uptimeSeconds": uptime_seconds(started_at),
        "checks": {
            "http": "ready",
            "worker": "configured",
        },
    }
