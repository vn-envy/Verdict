# Backend — FastAPI deliberation engine (Microsoft Agent Framework swarm).
# Build context is ./backend (see azure.yaml service "orchestrator").
FROM python:3.11-slim

WORKDIR /app

# System deps kept minimal; the Azure SDKs are pure-Python wheels.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a non-root user (defense-in-depth; ACA doesn't require root).
RUN useradd -m -u 10001 appuser && chown -R appuser /app
USER appuser

ENV PORT=8000 PYTHONUNBUFFERED=1
EXPOSE 8000

# Keyless at runtime via the container app's user-assigned managed identity (DefaultAzureCredential).
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT}"]
