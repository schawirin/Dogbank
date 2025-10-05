FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /build

# Instalar POM raiz
COPY pom.xml .
RUN mvn -N install

# Buildar notification-module
COPY notification-module/pom.xml notification-module/
COPY notification-module/src notification-module/src
RUN mvn -f notification-module/pom.xml clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/notification-module/target/notification-module-1.0-SNAPSHOT.jar app.jar
EXPOSE 8083
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "/app/app.jar"]