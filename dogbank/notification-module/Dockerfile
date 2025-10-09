FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /build
COPY notification-module/pom.xml pom.xml
COPY notification-module/src src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/target/*.jar app.jar
EXPOSE 8083
ENTRYPOINT ["java", "-jar", "/app/app.jar"]