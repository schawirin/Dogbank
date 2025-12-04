FROM maven:3.9.7-eclipse-temurin-21 AS builder
WORKDIR /build
COPY bancocentral-module/pom.xml pom.xml
COPY bancocentral-module/src src
RUN mvn clean package spring-boot:repackage -DskipTests
RUN echo "=== Listing target ===" && ls -lah /build/target/

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /build/target/bancocentral-module-1.0-SNAPSHOT.jar app.jar
EXPOSE 8085
ENTRYPOINT ["java", "-jar", "/app/app.jar"]