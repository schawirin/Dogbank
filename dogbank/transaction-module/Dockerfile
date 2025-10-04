FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /app

# Copiar POM pai
COPY pom.xml ./pom.xml

# Copiar POMs de todos os módulos necessários
COPY account-module/pom.xml ./account-module/pom.xml
COPY auth-module/pom.xml ./auth-module/pom.xml
COPY bancocentral-module/pom.xml ./bancocentral-module/pom.xml
COPY transaction-module/pom.xml ./transaction-module/pom.xml

# Copiar código fonte apenas dos módulos necessários
COPY account-module/src ./account-module/src
COPY auth-module/src ./auth-module/src
COPY bancocentral-module/src ./bancocentral-module/src
COPY transaction-module/src ./transaction-module/src

# Build apenas do transaction-module e suas dependências
RUN mvn -pl transaction-module -am clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copiar APENAS o JAR do transaction-module
COPY --from=builder /app/transaction-module/target/transaction-module-1.0-SNAPSHOT.jar app.jar

EXPOSE 8084
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "/app/app.jar"]