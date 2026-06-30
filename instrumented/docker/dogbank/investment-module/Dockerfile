FROM maven:3.9.7-eclipse-temurin-21 AS builder
WORKDIR /app
COPY investment-module/ .
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app

RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
RUN mkdir -p /var/log/dogbank && chown -R appuser:appgroup /var/log/dogbank

COPY --from=builder /app/target/investment-module-*.jar app.jar
RUN chown appuser:appgroup app.jar

USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8091/actuator/health || exit 1

ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:+UseContainerSupport"
ENV DD_AGENT_HOST="datadog-agent"
ENV DD_SERVICE="investment-service"
ENV DD_ENV="dogbank"
ENV DD_VERSION="1.0.0"
ENV DD_LOGS_INJECTION="true"
ENV DD_TRACE_SAMPLE_RATE="1"
ENV DD_PROFILING_ENABLED="true"
ENV DOGBANK_LOG_DIR="/var/log/dogbank"

EXPOSE 8091
ENTRYPOINT ["sh", "-c", "AGENT_OPT=''; if [ -f /app/dd-java-agent.jar ]; then AGENT_OPT='-javaagent:/app/dd-java-agent.jar'; fi; exec java $AGENT_OPT $JAVA_OPTS -jar app.jar"]
