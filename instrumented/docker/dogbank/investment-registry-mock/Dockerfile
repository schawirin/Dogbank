FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app
COPY investment-registry-mock/pom.xml ./pom.xml
COPY investment-registry-mock/src ./src

RUN mvn -q clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8092

USER appuser

ENTRYPOINT ["sh", "-c", "if [ -f /app/dd-java-agent.jar ]; then exec java -javaagent:/app/dd-java-agent.jar -jar /app/app.jar; else exec java -jar /app/app.jar; fi"]
