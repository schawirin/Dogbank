FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /app

COPY pom.xml ./pom.xml
COPY auth-module/pom.xml ./auth-module/pom.xml
COPY account-module/pom.xml ./account-module/pom.xml
COPY transaction-module/pom.xml ./transaction-module/pom.xml
COPY bancocentral-module/pom.xml ./bancocentral-module/pom.xml
COPY integration-module/pom.xml ./integration-module/pom.xml
COPY notification-module/pom.xml ./notification-module/pom.xml

COPY bancocentral-module/src ./bancocentral-module/src

RUN mvn -pl bancocentral-module -am clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/bancocentral-module/target/bancocentral-module-1.0-SNAPSHOT.jar app.jar
EXPOSE 8085
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "/app/app.jar"]