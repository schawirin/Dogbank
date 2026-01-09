FROM maven:3.9.5-eclipse-temurin-21 AS builder

WORKDIR /app

# Copy pom.xml and download dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build
COPY src ./src
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Copy the built jar
COPY --from=builder /app/target/*.jar app.jar

# Copy Datadog agent (if available)
COPY --from=builder /app/dd-java-agent.jar /app/dd-java-agent.jar 2>/dev/null || true

# Expose port
EXPOSE 8083

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8083/api/chatbot/health || exit 1

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
