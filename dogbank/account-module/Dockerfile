FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /build

# Instalar POM raiz
COPY pom.xml .
RUN mvn -N install

# Buildar account-module
COPY account-module/pom.xml account-module/
COPY account-module/src account-module/src
RUN mvn -f account-module/pom.xml clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/account-module/target/account-module-1.0-SNAPSHOT.jar app.jar
EXPOSE 8089
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "/app/app.jar"]