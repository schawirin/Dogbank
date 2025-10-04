FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /app

# Copiar POM pai
COPY pom.xml ./pom.xml

# Copiar POM do integration-module
COPY integration-module/pom.xml ./integration-module/pom.xml

# Copiar código fonte
COPY integration-module/src ./integration-module/src

# Build
RUN mvn -pl integration-module -am clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copiar APENAS o JAR do integration-module
COPY --from=builder /app/integration-module/target/integration-module-1.0-SNAPSHOT.jar app.jar

EXPOSE 8082
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "/app/app.jar"]