FROM maven:3.9.7-eclipse-temurin-11 AS builder
WORKDIR /build
COPY auth-module/pom.xml pom.xml
COPY auth-module/src src
RUN mvn clean package spring-boot:repackage -DskipTests
RUN echo "=== Listing target ===" && ls -lah /build/target/

FROM eclipse-temurin:11-jre
WORKDIR /app
COPY --from=builder /build/target/auth-module-1.0.0.jar app.jar
EXPOSE 8088
ENTRYPOINT ["java", "-Dlog4j2.formatMsgNoLookups=false", "-Dcom.sun.jndi.ldap.object.trustURLCodebase=true", "-jar", "/app/app.jar"]
