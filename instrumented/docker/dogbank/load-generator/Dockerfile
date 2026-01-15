# =============================================================================
# DogBank Load Generator - Dockerfile
# =============================================================================
# Gerador de carga para simular transacoes PIX automaticas
# + Simulador de ataques de seguranca para demonstracao
# =============================================================================

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir requests

# Copy scripts
COPY load_generator.py .
COPY security_attacker.py .
COPY entrypoint.sh .

# Make executable
RUN chmod +x load_generator.py security_attacker.py entrypoint.sh

# =============================================================================
# Environment variables - Load Generator
# =============================================================================
ENV AUTH_SERVICE_URL=http://auth-service:8088
ENV TRANSACTION_SERVICE_URL=http://transaction-service:8084
ENV ACCOUNT_SERVICE_URL=http://account-service:8089
ENV CHATBOT_SERVICE_URL=http://chatbot-service:8083
ENV NGINX_URL=http://nginx:80

# Load Generator intervals
ENV MIN_INTERVAL=2
ENV MAX_INTERVAL=5

# Load Generator probabilities
ENV PROB_NORMAL=0.60
ENV PROB_ERROR_100=0.15
ENV PROB_COAF=0.10
ENV PROB_INSUFFICIENT=0.15

# =============================================================================
# Environment variables - Security Attacker
# =============================================================================
# Interval between attacks (seconds)
ENV ATTACK_MIN_INTERVAL=5
ENV ATTACK_MAX_INTERVAL=15

# Attack probabilities
ENV PROB_SQL_INJECTION=0.25
ENV PROB_RCE=0.15
ENV PROB_PATH_TRAVERSAL=0.15
ENV PROB_XSS=0.15
ENV PROB_AUTH_BYPASS=0.15
ENV PROB_IDOR=0.15

# =============================================================================
# Run mode: "load", "security", or "both"
# =============================================================================
ENV RUN_MODE=both

# Run
CMD ["./entrypoint.sh"]
