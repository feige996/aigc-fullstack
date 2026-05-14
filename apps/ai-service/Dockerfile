FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV PATH=/opt/venv/bin:$PATH

RUN pip install --no-cache-dir uv

WORKDIR /app

COPY apps/ai-service/pyproject.toml ./pyproject.toml
COPY apps/ai-service/uv.lock ./uv.lock

RUN uv sync --frozen --no-dev --no-install-project

COPY apps/ai-service/src ./src

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health').read()"

CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
