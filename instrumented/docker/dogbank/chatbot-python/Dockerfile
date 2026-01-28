# =============================================================================
# DogBank Chatbot Service - Python Edition
# =============================================================================
# With Datadog LLM Observability instrumentation
# =============================================================================

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Expose port
EXPOSE 8083

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8083/api/chatbot/health || exit 1

# Datadog APM auto-instrumentation is injected by the Datadog Admission Controller
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8083"]
