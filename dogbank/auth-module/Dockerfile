FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /build
COPY auth-module/pom.xml pom.xml
COPY auth-module/src src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/target/auth-module-1.0.0.jar app.jar
EXPOSE 8088
ENTRYPOINT ["java", "-jar", "/app/app.jar"]