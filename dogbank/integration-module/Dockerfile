FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /build
COPY integration-module/pom.xml pom.xml
COPY integration-module/src src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/target/*.jar app.jar
EXPOSE 8087
ENTRYPOINT ["java", "-jar", "/app/app.jar"]