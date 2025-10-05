FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /build

# 1. Instalar o POM raiz no repositório local
COPY pom.xml .
RUN mvn -N install

# 2. Buildar account-module (dependência do authddd)
COPY account-module/pom.xml account-module/
COPY account-module/src account-module/src
RUN mvn -f account-module/pom.xml clean install -DskipTests

# 3. Buildar auth-module
COPY auth-module/pom.xml auth-module/
COPY auth-module/src auth-module/src
RUN mvn -f auth-module/pom.xml clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/auth-module/target/auth-module-1.0-SNAPSHOT.jar app.jar
EXPOSE 8088
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "/app/app.jar"]