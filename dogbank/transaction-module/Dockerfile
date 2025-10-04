FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /app

COPY pom.xml ./pom.xml
COPY auth-module/pom.xml ./auth-module/pom.xml
COPY account-module/pom.xml ./account-module/pom.xml
COPY transaction-module/pom.xml ./transaction-module/pom.xml
COPY bancocentral-module/pom.xml ./bancocentral-module/pom.xml
COPY integration-module/pom.xml ./integration-module/pom.xml
COPY notification-module/pom.xml ./notification-module/pom.xml

COPY auth-module/src ./auth-module/src
COPY account-module/src ./account-module/src
COPY bancocentral-module/src ./bancocentral-module/src
COPY transaction-module/src ./transaction-module/src

RUN mvn -pl transaction-module -am clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/transaction-module/target/transaction-module-1.0-SNAPSHOT.jar app.jar
EXPOSE 8084
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "/app/app.jar"]