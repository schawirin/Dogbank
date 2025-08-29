# transaction-module/Dockerfile
FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /workspace
COPY . .
RUN mvn -q -pl transaction-module -am package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /workspace/transaction-module/target/*.jar app.jar
EXPOSE 8084
ENTRYPOINT ["java","-XX:+UseContainerSupport","-jar","/app/app.jar"]
