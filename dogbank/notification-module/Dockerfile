FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /workspace

COPY . .
RUN mvn -q -pl notification-module -am package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

COPY --from=builder /workspace/notification-module/target/*.jar app.jar

EXPOSE 8083
ENTRYPOINT ["java","-XX:+UseContainerSupport","-jar","/app/app.jar"]
