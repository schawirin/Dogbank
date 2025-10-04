FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /app

# Copiar POM pai
COPY pom.xml ./pom.xml

# Copiar POM do account-module
COPY account-module/pom.xml ./account-module/pom.xml

# Copiar código fonte
COPY account-module/src ./account-module/src

# Build
RUN mvn -pl account-module -am clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copiar APENAS o JAR do account-module
COPY --from=builder /app/account-module/target/account-module-1.0-SNAPSHOT.jar app.jar

EXPOSE 8089
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "/app/app.jar"]