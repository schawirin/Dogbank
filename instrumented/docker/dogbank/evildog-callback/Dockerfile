# EvilDog Callback Server — Log4Shell exfiltration listener (DogBank lab only)
FROM python:3.12-slim

LABEL org.opencontainers.image.title="evildog-callback" \
      org.opencontainers.image.description="Log4Shell (CVE-2021-44228) JNDI/LDAP exfiltration listener for the DogBank EBC lab" \
      com.datadoghq.tags.env="dogbank" \
      com.datadoghq.tags.service="evildog-callback" \
      com.datadoghq.tags.team="security"

WORKDIR /app
COPY server.py /app/server.py

ENV LDAP_PORT=1389 \
    HTTP_PORT=8000 \
    PYTHONUNBUFFERED=1

EXPOSE 1389 8000

# No external dependencies — pure stdlib.
CMD ["python", "/app/server.py"]
