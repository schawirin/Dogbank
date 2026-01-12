# =============================================================================
# PIX Worker - Dockerfile
# =============================================================================
# Kafka consumer for processing PIX transactions asynchronously
# =============================================================================

FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Copy pom.xml and download dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build
COPY src ./src
RUN mvn clean package -DskipTests

# =============================================================================
# Runtime Stage
# =============================================================================
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Install wget for health checks
RUN apk add --no-cache wget

# Download Datadog Java Agent (using ADD is more reliable than curl)
ADD https://dtdg.co/latest-java-tracer dd-java-agent.jar

# Copy JAR from builder
COPY --from=builder /app/target/*.jar app.jar

# Expose port
EXPOSE 8090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -q --spider http://localhost:8090/actuator/health || exit 1

# JVM and Datadog configuration
ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:+UseContainerSupport"
ENV DD_AGENT_HOST="datadog-agent"
ENV DD_SERVICE="pix-worker"
ENV DD_ENV="dogbank"
ENV DD_VERSION="1.0.0"
ENV DD_LOGS_INJECTION="true"
ENV DD_TRACE_SAMPLE_RATE="1"
ENV DD_PROFILING_ENABLED="true"
ENV DD_DATA_STREAMS_ENABLED="true"
ENV DD_TRACE_KAFKA_ENABLED="true"

# Run with Datadog Java agent
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -javaagent:/app/dd-java-agent.jar -jar app.jar"]
