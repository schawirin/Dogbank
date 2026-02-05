FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for python-snappy
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libsnappy-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import redis; r=redis.Redis(host='${REDIS_HOST:-redis}', port=int('${REDIS_PORT:-6379}')); r.ping()" || exit 1

# Run with ddtrace
CMD ["ddtrace-run", "python", "-u", "app/main.py"]
