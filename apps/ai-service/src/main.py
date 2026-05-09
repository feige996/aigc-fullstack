from fastapi import FastAPI

app = FastAPI(title="AIGC AI Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "service": "ai-service",
        "status": "ok",
    }
