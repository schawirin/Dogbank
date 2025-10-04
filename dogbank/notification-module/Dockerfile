FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /app

# Copiar POM pai
COPY pom.xml ./pom.xml

# Copiar POM do notification-module
COPY notification-module/pom.xml ./notification-module/pom.xml

# Copiar código fonte
COPY notification-module/src ./notification-module/src

# Build
RUN mvn -pl notification-module -am clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copiar APENAS o JAR do notification-module
COPY --from=builder /app/notification-module/target/notification-module-1.0-SNAPSHOT.jar app.jar

EXPOSE 8083
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "/app/app.jar"]