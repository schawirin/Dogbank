# ---- build
FROM maven:3.9.6-eclipse-temurin-17 AS builder
WORKDIR /build
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package
# (opcional p/ debug)
# RUN ls -lah target

# ---- runtime
FROM eclipse-temurin:17-jre
WORKDIR /app
ARG JAR_FILE=/build/target/*.jar
COPY --from=builder ${JAR_FILE} app.jar
EXPOSE 8088
ENTRYPOINT ["java","-jar","/app/app.jar"]
