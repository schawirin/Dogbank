FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /build
COPY transaction-module/pom.xml pom.xml
COPY transaction-module/src src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/target/*-module-*.jar app.jar
EXPOSE 8084
ENTRYPOINT ["java", "-jar", "/app/app.jar"]