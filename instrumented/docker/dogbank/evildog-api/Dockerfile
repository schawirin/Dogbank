# =============================================================================
# EvilDog API — Attack Orchestrator backend (DogBank LAB ONLY)
# -----------------------------------------------------------------------------
# Wraps the existing SecurityAttacker engine behind REST + SSE so the in-app
# EvilDog tab can drive REAL, lab-scoped attacks and stream live telemetry.
# Datadog APM auto-instrumentation is injected by the Admission Controller (k8s).
# =============================================================================
FROM python:3.11-slim

LABEL org.opencontainers.image.title="evildog-api" \
      org.opencontainers.image.description="EvilDog attack orchestrator API for the DogBank EBC lab" \
      com.datadoghq.tags.env="dogbank" \
      com.datadoghq.tags.service="evildog-api" \
      com.datadoghq.tags.team="security"

WORKDIR /app

# Ferramentas hacker REAIS usadas pelos estágios do pipeline (nmap = recon/scan, sqlmap = detect)
RUN apt-get update && apt-get install -y --no-install-recommends curl nmap sqlmap \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Vendored attack engine (kept in sync with load-generator/security_attacker.py)
COPY security_attacker.py ./security_attacker.py
COPY app/ ./app/

EXPOSE 8092

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8092/api/evildog/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8092"]
