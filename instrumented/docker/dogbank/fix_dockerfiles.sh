#!/bin/bash

# Array com módulos e suas portas
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

# Copiar projeto inteiro
COPY pom.xml .
COPY auth-module auth-module
COPY account-module account-module
COPY transaction-module transaction-module
COPY bancocentral-module bancocentral-module
COPY integration-module integration-module
COPY notification-module notification-module

# Buildar apenas este módulo
RUN mvn -pl $module -am clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/$module/target/$module-1.0-SNAPSHOT.jar app.jar
EXPOSE $port
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
EOF

  echo "✅ Criado $module/Dockerfile"
done

echo "🎉 Todos os Dockerfiles foram corrigidos!"
