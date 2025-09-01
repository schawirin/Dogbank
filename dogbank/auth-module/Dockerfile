########################
# build stage (com testes)
########################
FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /workspace

# cache de dependências
COPY pom.xml .
COPY auth-module/pom.xml auth-module/pom.xml
RUN mvn -q -pl auth-module -am dependency:go-offline

# código
COPY . .
# roda testes com o profile test (H2), depois empacota
RUN mvn -q -pl auth-module -am -Dspring.profiles.active=test clean verify
# se quiser garantir que o package use o mesmo resultado de testes:
RUN mvn -q -pl auth-module -am -DskipTests=false package

########################
# runtime stage
########################
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

COPY --from=builder /workspace/auth-module/target/*.jar app.jar

EXPOSE 8088
ENTRYPOINT ["java","-XX:+UseContainerSupport","-jar","/app/app.jar"]
