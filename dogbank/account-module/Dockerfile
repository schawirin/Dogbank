FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /build
COPY account-module/pom.xml pom.xml
COPY account-module/src src
RUN mvn clean package spring-boot:repackage -DskipTests
RUN echo "=== Listing target ===" && ls -lah /build/target/

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/target/account-module-1.0-SNAPSHOT.jar app.jar
EXPOSE 8089
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
