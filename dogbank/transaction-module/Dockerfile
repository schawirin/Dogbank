FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /build

# Instalar POM raiz
COPY pom.xml .
RUN mvn -N install

# Buildar dependências (auth e account são necessários para transaction)
COPY account-module/pom.xml account-module/
COPY account-module/src account-module/src
RUN mvn -f account-module/pom.xml clean install -DskipTests

COPY auth-module/pom.xml auth-module/
COPY auth-module/src auth-module/src
RUN mvn -f auth-module/pom.xml clean install -DskipTests

COPY bancocentral-module/pom.xml bancocentral-module/
COPY bancocentral-module/src bancocentral-module/src
RUN mvn -f bancocentral-module/pom.xml clean install -DskipTests

# Buildar transaction-module
COPY transaction-module/pom.xml transaction-module/
COPY transaction-module/src transaction-module/src
RUN mvn -f transaction-module/pom.xml clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/transaction-module/target/transaction-module-1.0-SNAPSHOT.jar app.jar
EXPOSE 8084
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "/app/app.jar"]