from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any
from uuid import uuid4


@dataclass(frozen=True)
class RequestContext:
    request_id: str
    trace_id: str


def create_request_context(request_id: str | None = None, trace_id: str | None = None) -> RequestContext:
    resolved_request_id = request_id.strip() if request_id and request_id.strip() else str(uuid4())
    resolved_trace_id = trace_id.strip() if trace_id and trace_id.strip() else resolved_request_id
    return RequestContext(request_id=resolved_request_id, trace_id=resolved_trace_id)


def log_json(level: str, event: str, **fields: Any) -> None:
    payload = {
        "level": level,
        "event": event,
        **fields,
    }
    print(json.dumps(payload, ensure_ascii=True, separators=(",", ":")))


def masked_prompt(prompt: str) -> str:
    stripped = prompt.strip()
    if not stripped:
        return ""
    if len(stripped) <= 24:
        return "***"
    return f"{stripped[:12]}...{stripped[-8:]}"


def uptime_seconds(start_time: float) -> int:
    return int(time.monotonic() - start_time)
