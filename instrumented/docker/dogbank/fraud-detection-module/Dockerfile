# =============================================================================
# Dockerfile para fraud-detection-module com Datadog APM
# =============================================================================

FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests

# =============================================================================
# Runtime stage
# =============================================================================
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Install wget for health checks
RUN apk add --no-cache wget

# Copy application
COPY --from=builder /app/target/*.jar app.jar

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8091/actuator/health || exit 1

# Expose port
EXPOSE 8091

# JVM and Datadog configuration
ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:+UseContainerSupport"
ENV DD_AGENT_HOST="datadog-agent"
ENV DD_SERVICE="fraud-detection-service"
ENV DD_ENV="dogbank"
ENV DD_VERSION="1.0.0"
ENV DD_LOGS_INJECTION="true"
ENV DD_TRACE_SAMPLE_RATE="1"
ENV DD_PROFILING_ENABLED="true"
ENV DD_DATA_STREAMS_ENABLED="true"
ENV DD_TRACE_RABBITMQ_ENABLED="true"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
