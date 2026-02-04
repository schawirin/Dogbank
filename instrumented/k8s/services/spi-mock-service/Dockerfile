# SPI Mock Service - Simula API do Banco Central (BACEN)
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app
COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Download Datadog Java Agent
ADD https://dtdg.co/latest-java-tracer /app/dd-java-agent.jar

COPY --from=builder /app/target/*.jar app.jar

# Expose port
EXPOSE 8090

# Run with Datadog agent
ENTRYPOINT ["java", "-javaagent:/app/dd-java-agent.jar", "-jar", "app.jar"]
