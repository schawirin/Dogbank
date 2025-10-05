FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /build

# Instalar POM raiz
COPY pom.xml .
RUN mvn -N install

# Buildar bancocentral-module
COPY bancocentral-module/pom.xml bancocentral-module/
COPY bancocentral-module/src bancocentral-module/src
RUN mvn -f bancocentral-module/pom.xml clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/bancocentral-module/target/bancocentral-module-1.0-SNAPSHOT.jar app.jar
EXPOSE 8085
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "/app/app.jar"]