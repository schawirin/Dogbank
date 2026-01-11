# =============================================================================
# DogBank Load Generator - Dockerfile
# =============================================================================
# Gerador de carga para simular transações PIX automáticas
# =============================================================================

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir requests

# Copy script
COPY load_generator.py .

# Make executable
RUN chmod +x load_generator.py

# Environment variables
ENV AUTH_SERVICE_URL=http://auth-service:8088
ENV TRANSACTION_SERVICE_URL=http://transaction-service:8084
ENV ACCOUNT_SERVICE_URL=http://account-service:8089
ENV MIN_INTERVAL=2
ENV MAX_INTERVAL=5
ENV PROB_NORMAL=0.60
ENV PROB_ERROR_100=0.15
ENV PROB_COAF=0.10
ENV PROB_INSUFFICIENT=0.15

# Run
CMD ["python", "-u", "load_generator.py"]
