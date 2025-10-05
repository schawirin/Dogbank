FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /build

# Instalar POM raiz
COPY pom.xml .
RUN mvn -N install

# Buildar integration-module
COPY integration-module/pom.xml integration-module/
COPY integration-module/src integration-module/src
RUN mvn -f integration-module/pom.xml clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/integration-module/target/integration-module-1.0-SNAPSHOT.jar app.jar
EXPOSE 8087
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "/app/app.jar"]