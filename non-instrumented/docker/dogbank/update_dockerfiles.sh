#!/bin/bash

declare -A modules
modules[auth-module]=8088
modules[account-module]=8089
modules[transaction-module]=8084
modules[bancocentral-module]=8085
modules[integration-module]=8087
modules[notification-module]=8083

for module in "${!modules[@]}"; do
  port=${modules[$module]}
  
  cat > $module/Dockerfile << EOF
FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /build

# Copiar apenas este módulo
COPY $module/pom.xml pom.xml
COPY $module/src src

# Buildar
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/target/$module-1.0-SNAPSHOT.jar app.jar
EXPOSE $port
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
EOF

  echo "✅ $module/Dockerfile"
done
