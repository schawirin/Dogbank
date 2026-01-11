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

# Copy JAR from builder
COPY --from=builder /app/target/*.jar app.jar

# Expose port
EXPOSE 8090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -q --spider http://localhost:8090/actuator/health || exit 1

# Run with Datadog Java agent (mounted via volume)
ENTRYPOINT ["java", \
    "-javaagent:/app/dd-java-agent.jar", \
    "-Ddd.service=pix-worker", \
    "-Ddd.env=dogbank", \
    "-Ddd.version=1.0.0", \
    "-Ddd.logs.injection=true", \
    "-Ddd.trace.kafka.enabled=true", \
    "-Ddd.kafka.legacy.tracing.enabled=false", \
    "-jar", "app.jar"]
