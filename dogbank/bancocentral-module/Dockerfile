########################
# build stage
########################
FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /workspace

COPY . .

# ► compila partindo do POM do módulo
RUN mvn -q -f bancocentral-module/pom.xml -am package -DskipTests

########################
# runtime stage
########################
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

COPY --from=builder /workspace/bancocentral-module/target/*.jar app.jar

EXPOSE 8085
ENTRYPOINT ["java","-XX:+UseContainerSupport","-jar","/app/app.jar"]
